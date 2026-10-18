const logger = require('../../config/logger');
const StubSmsProvider = require('./providers/StubSmsProvider');
const PingAfricaSmsProvider = require('./providers/PingAfricaSmsProvider');
const systemConfigService = require('../systemConfigService');

/**
 * SmsService — strategy-pattern router that delegates to the configured SMS provider.
 * Mirrors services/email/EmailService.js.
 *
 * Provider is resolved lazily from SystemConfig (key: sms.provider), cached, and
 * reset on send failure so config changes take effect on next call.
 *
 * Supported providers:
 *   ping-africa — Ping Africa bulk SMS API (configs: sms.provider.ping-africa.*)
 *   stub        — logs + fails (fallback when nothing is configured)
 * Add further providers under ./providers and wire them up in _resolveProvider —
 * the rest of the notification pipeline (dispatcher, outbox worker, SmsChannel)
 * needs no changes.
 *
 * Usage:
 *   const smsService = require('./SmsService');
 *   await smsService.send({ to, body });
 *   await smsService.sendBulk({ recipients, body });
 */
class SmsService {
  constructor() {
    this._provider = null;
  }

  async _resolveProvider() {
    if (this._provider) return this._provider;

    const providerName = await systemConfigService.getConfigValue('sms.provider', 'string', 'stub');
    logger.info(`[SmsService] Resolving SMS provider: ${providerName}`);

    if (providerName === 'ping-africa') {
      const getVal = (key) => systemConfigService.getConfigValue(key, 'string', null);
      this._provider = new PingAfricaSmsProvider({
        apiToken: await getVal('sms.provider.ping-africa.api_token'),
        senderId: await getVal('sms.provider.ping-africa.sender_id'),
        baseUrl: await getVal('sms.provider.ping-africa.base_url'),
      });
      return this._provider;
    }

    // Unknown provider names fall back to the stub so notifications never crash
    // the app — they just fail with a clear error.
    this._provider = new StubSmsProvider();
    return this._provider;
  }

  /**
   * Send an SMS using the configured provider.
   * @param {object} opts
   * @param {string} opts.to   - Recipient phone number
   * @param {string} opts.body - Message text
   */
  async send({ to, body }) {
    try {
      const provider = await this._resolveProvider();
      return await provider.send({ to, body });
    } catch (err) {
      this._provider = null;
      logger.error(`[SmsService] send failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Send the same SMS to many recipients using the configured provider.
   * @param {object} opts
   * @param {string[]} opts.recipients - Recipient phone numbers
   * @param {string} opts.body         - Message text
   */
  async sendBulk({ recipients, body }) {
    try {
      const provider = await this._resolveProvider();
      return await provider.sendBulk({ recipients, body });
    } catch (err) {
      this._provider = null;
      logger.error(`[SmsService] sendBulk failed: ${err.message}`);
      throw err;
    }
  }

  /** Bust the cached provider instance. Call after updating sms.* system configs. */
  resetProvider() {
    this._provider = null;
    logger.info('[SmsService] Provider cache cleared');
  }
}

// Singleton — shared across the app
module.exports = new SmsService();
