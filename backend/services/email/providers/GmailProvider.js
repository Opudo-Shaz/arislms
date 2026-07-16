const nodemailer = require('nodemailer');
const logger = require('../../../config/logger');

/**
 * Email provider backed by Gmail / any SMTP server.
 * Credentials and host are injected at construction time from EmailService.
 */
class GmailProvider {
  /**
   * @param {object} config
   * @param {string}  config.user          - SMTP username (Gmail address)
   * @param {string}  config.pass          - SMTP password / App Password
   * @param {string} [config.host]         - SMTP host (default: smtp.gmail.com)
   * @param {string|number} [config.port]  - SMTP port (default: 587)
   * @param {boolean|string} [config.secure] - TLS on connect (default: false = STARTTLS)
   * @param {string} [config.fromName]     - Sender display name
   * @param {string} [config.fromAddress]  - Sender address (falls back to user)
   */
  constructor(config) {
    if (!config.user || !config.pass) {
      throw new Error('GmailProvider: user and pass are required');
    }
    this.config = config;
    this._transporter = null;
  }

  _buildTransporter() {
    return nodemailer.createTransport({
      host:   this.config.host   || 'smtp.gmail.com',
      port:   Number(this.config.port)   || 587,
      secure: this.config.secure === true || this.config.secure === 'true',
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
    });
  }

  _getTransporter() {
    if (!this._transporter) {
      this._transporter = this._buildTransporter();
    }
    return this._transporter;
  }

  /**
   * Send an email.
   * @param {object} opts
   * @param {string} opts.to      - Recipient email address
   * @param {string} opts.subject - Email subject line
   * @param {string} opts.html    - HTML body
   * @param {string} [opts.text]  - Plain-text fallback
   */
  async send({ to, subject, html, text }) {
    const transporter = this._getTransporter();

    const fromAddress = this.config.fromAddress || this.config.user;
    const from = this.config.fromName
      ? `"${this.config.fromName}" <${fromAddress}>`
      : fromAddress;

    const info = await transporter.sendMail({ from, to, subject, html, text });

    logger.info(`[GmailProvider] Email sent to ${to} | messageId=${info.messageId}`);
    return info;
  }
}

module.exports = GmailProvider;
