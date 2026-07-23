const logger = require('../../config/logger');
const GmailProvider = require('./providers/GmailProvider');
const GmailApiProvider = require('./providers/GmailApiProvider');
const systemConfigService = require('../systemConfigService');

/**
 * EmailService — strategy-pattern router that delegates to the configured provider.
 *
 * Provider is resolved lazily from SystemConfig (key: email.provider) the first
 * time send() is called, then cached. Call resetProvider() after changing email
 * system configs so the next send picks up the new values.
 *
 * Supported providers:
 *   gmail     — Gmail SMTP via nodemailer     (configs: email.provider.gmail.*)
 *   gmail-api — Gmail REST API via OAuth2     (configs: email.provider.gmail-api.*)
 *
 * Usage:
 *   const emailService = require('./EmailService');
 *   await emailService.send({ to, subject, html, text });
 */
class EmailService {
  constructor() {
    this._provider = null;
  }

  /** @returns {Promise<GmailProvider|GmailApiProvider>} */
  async _resolveProvider() {
    if (this._provider) return this._provider;

    const getVal = (key, defaultValue = null) =>
      systemConfigService.getConfigValue(key, 'string', defaultValue);

    const providerName = await getVal('email.provider', 'gmail');

    logger.info(`[EmailService] Resolving email provider: ${providerName}`);

    if (providerName === 'gmail') {
      const config = {
        host:        await getVal('email.provider.gmail.host',    'smtp.gmail.com'),
        port:        await getVal('email.provider.gmail.port',    '587'),
        secure:      await getVal('email.provider.gmail.secure',  'false'),
        user:        await getVal('email.provider.gmail.user'),
        pass:        await getVal('email.provider.gmail.pass'),
        fromName:    await getVal('email.from_name',              'ARISLMS'),
        fromAddress: await getVal('email.from_address'),
      };
      if (!config.fromAddress) config.fromAddress = config.user;

      if (!config.user || !config.pass) {
        throw new Error(
          'Gmail SMTP credentials are not configured. ' +
          'Set email.provider.gmail.user and email.provider.gmail.pass in System Config, ' +
          'or set EMAIL_PROVIDER_GMAIL_USER / EMAIL_PROVIDER_GMAIL_PASS environment variables.'
        );
      }

      this._provider = new GmailProvider(config);
      return this._provider;
    }

    if (providerName === 'gmail-api') {
      const config = {
        clientId:     await getVal('email.provider.gmail-api.client_id'),
        clientSecret: await getVal('email.provider.gmail-api.client_secret'),
        refreshToken: await getVal('email.provider.gmail-api.refresh_token'),
        user:         await getVal('email.provider.gmail-api.user'),
        fromName:     await getVal('email.from_name', 'ARISLMS'),
        fromAddress:  await getVal('email.from_address'),
      };
      if (!config.fromAddress) config.fromAddress = config.user;

      if (!config.clientId || !config.clientSecret || !config.refreshToken || !config.user) {
        throw new Error(
          'Gmail API credentials are not configured. ' +
          'Set email.provider.gmail-api.client_id, client_secret, refresh_token, and user in System Config, ' +
          'or set EMAIL_PROVIDER_GMAIL_API_CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN / USER environment variables.'
        );
      }

      this._provider = new GmailApiProvider(config);
      return this._provider;
    }

    throw new Error(
      `Unsupported email provider: "${providerName}". ` +
      'Update the email.provider system config. Currently supported: gmail, gmail-api'
    );
  }

  /**
   * Send an email using the configured provider.
   *
   * @param {object} opts
   * @param {string} opts.to      - Recipient address
   * @param {string} opts.subject - Subject line
   * @param {string} opts.html    - HTML body
   * @param {string} [opts.text]  - Plain-text fallback
   */
  async send({ to, subject, html, text }) {
    try {
      const provider = await this._resolveProvider();
      return await provider.send({ to, subject, html, text });
    } catch (err) {
      // Reset cached provider on send failure so next attempt re-reads config
      this._provider = null;
      logger.error(`[EmailService] send failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Bust the cached provider instance.
   * Call this after updating email system configs so the next send re-reads them.
   */
  resetProvider() {
    this._provider = null;
    logger.info('[EmailService] Provider cache cleared');
  }
}

// Singleton — shared across the app
module.exports = new EmailService();
