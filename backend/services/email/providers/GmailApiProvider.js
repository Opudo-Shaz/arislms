const { google } = require('googleapis');
const logger = require('../../../config/logger');

/**
 * Email provider backed by the Gmail API (OAuth2).
 *
 * Use this instead of GmailProvider (SMTP) when the hosting environment blocks
 * outbound SMTP connections.
 *
 * Required OAuth2 credentials:
 *   clientId, clientSecret, refreshToken — obtained from Google Cloud Console
 *   for a project with the Gmail API enabled and the sending account authorised
 *   with scope https://mail.google.com/
 *
 * All credentials can be stored in SystemConfig (email.provider.gmail-api.*)
 * or as environment variables (see EmailService.js for key names).
 */
class GmailApiProvider {
  /**
   * @param {object} config
   * @param {string}  config.clientId      - Google OAuth2 client ID
   * @param {string}  config.clientSecret  - Google OAuth2 client secret
   * @param {string}  config.refreshToken  - OAuth2 refresh token for the sender account
   * @param {string}  config.user          - Gmail address used as sender (From)
   * @param {string} [config.fromName]     - Sender display name
   * @param {string} [config.fromAddress]  - Sender address (falls back to user)
   */
  constructor(config) {
    const missing = ['clientId', 'clientSecret', 'refreshToken', 'user'].filter((k) => !config[k]);
    if (missing.length) {
      throw new Error(`GmailApiProvider: missing required config: ${missing.join(', ')}`);
    }
    this.config = config;
    this._gmail = null;
  }

  _buildClient() {
    const oauth2Client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      'https://developers.google.com/oauthplayground', // redirect URI (unused at runtime)
    );

    oauth2Client.setCredentials({ refresh_token: this.config.refreshToken });

    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  _getClient() {
    if (!this._gmail) {
      this._gmail = this._buildClient();
    }
    return this._gmail;
  }

  /**
   * Encode a plain UTF-8 string to base64url (RFC 4648 §5).
   * The Gmail API requires the raw RFC-2822 message in this encoding.
   */
  _toBase64url(str) {
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Build a minimal RFC-2822 message.
   * For proper multipart/alternative we include both text and html parts.
   */
  _buildRawMessage({ from, to, subject, html, text }) {
    const boundary = `----=_Part_${Date.now()}`;

    const headers = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ].join('\r\n');

    const textPart = text
      ? [
          `--${boundary}`,
          'Content-Type: text/plain; charset="UTF-8"',
          'Content-Transfer-Encoding: base64',
          '',
          Buffer.from(text).toString('base64'),
        ].join('\r\n')
      : '';

    const htmlPart = [
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(html).toString('base64'),
    ].join('\r\n');

    const closing = `--${boundary}--`;

    const parts = [textPart, htmlPart].filter(Boolean);
    const rawMessage = [headers, '', ...parts, closing].join('\r\n');

    return this._toBase64url(rawMessage);
  }

  /**
   * Send an email via the Gmail API.
   * @param {object} opts
   * @param {string} opts.to      - Recipient email address
   * @param {string} opts.subject - Email subject line
   * @param {string} opts.html    - HTML body
   * @param {string} [opts.text]  - Plain-text fallback
   */
  async send({ to, subject, html, text }) {
    const fromAddress = this.config.fromAddress || this.config.user;
    const from = this.config.fromName
      ? `"${this.config.fromName}" <${fromAddress}>`
      : fromAddress;

    const raw = this._buildRawMessage({ from, to, subject, html, text });

    const gmail = this._getClient();
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    logger.info(`[GmailApiProvider] Email sent to ${to} | messageId=${res.data.id}`);
    return res.data;
  }
}

module.exports = GmailApiProvider;
