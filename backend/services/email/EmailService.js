const logger = require('../../config/logger');
const GmailProvider = require('./providers/GmailProvider');

/**
 * EmailService — strategy-pattern router that delegates to the configured provider.
 *
 * Provider is resolved lazily from SystemConfig (key: email.provider) the first
 * time send() is called, then cached. Call resetProvider() after changing email
 * system configs so the next send picks up the new values.
 *
 * Supported providers:
 *   gmail — Gmail SMTP via nodemailer (configs: email.provider.gmail.*)
 *
 * Usage:
 *   const emailService = require('./EmailService');
 *   await emailService.send({ to, subject, html, text });
 */
class EmailService {
  constructor() {
    this._provider = null;
  }

  /** @returns {Promise<GmailProvider>} */
  async _resolveProvider() {
    if (this._provider) return this._provider;

    // Lazy-require to avoid circular-dependency / boot-order issues
    const SystemConfig = require('../../models/systemConfigModel');

    const getVal = async (key) => {
      const row = await SystemConfig.findOne({ where: { key }, attributes: ['value'] });
      return row?.value ?? null;
    };

    const providerName = (await getVal('email.provider')) || 'gmail';

    logger.info(`[EmailService] Resolving email provider: ${providerName}`);

    if (providerName === 'gmail') {
      const config = {
        host:        (await getVal('email.provider.gmail.host'))    || 'smtp.gmail.com',
        port:        (await getVal('email.provider.gmail.port'))    || '587',
        secure:      (await getVal('email.provider.gmail.secure'))  || 'false',
        user:        (await getVal('email.provider.gmail.user'))    || process.env.EMAIL_PROVIDER_GMAIL_USER,
        pass:        (await getVal('email.provider.gmail.pass'))    || process.env.EMAIL_PROVIDER_GMAIL_PASS,
        fromName:    (await getVal('email.from_name'))              || process.env.EMAIL_FROM_NAME    || 'ARISLMS',
        fromAddress: (await getVal('email.from_address'))           || process.env.EMAIL_PROVIDER_GMAIL_USER,
      };

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

    throw new Error(
      `Unsupported email provider: "${providerName}". ` +
      'Update the email.provider system config. Currently supported: gmail'
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
