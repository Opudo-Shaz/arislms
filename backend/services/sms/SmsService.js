const logger = require('../../config/logger');
const StubSmsProvider = require('./providers/StubSmsProvider');
const systemConfigService = require('../systemConfigService');

/**
 * SmsService — strategy-pattern router that delegates to the configured SMS provider.
 * Mirrors services/email/EmailService.js.
 *
 * Provider is resolved lazily from SystemConfig (key: sms.provider), cached, and
 * reset on send failure so config changes take effect on next call.
 *
 * Only a stub provider ships today (no SMS gateway integrated yet). Add real
 * providers (Twilio, Africa's Talking, etc.) under ./providers and wire them
 * up in _resolveProvider — the rest of the notification pipeline (dispatcher,
 * outbox worker, SmsChannel) needs no changes.
 *
 * Usage:
 *   const smsService = require('./SmsService');
 *   await smsService.send({ to, body });
 */
class SmsService {
  constructor() {
    this._provider = null;
  }

  async _resolveProvider() {
    if (this._provider) return this._provider;

    const providerName = await systemConfigService.getConfigValue('sms.provider', 'string', 'stub');
    logger.info(`[SmsService] Resolving SMS provider: ${providerName}`);

    // Only 'stub' is implemented today; unknown provider names fall back to it
    // so notifications never crash the app — they just fail with a clear error.
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

  /** Bust the cached provider instance. Call after updating sms.* system configs. */
  resetProvider() {
    this._provider = null;
    logger.info('[SmsService] Provider cache cleared');
  }
}

// Singleton — shared across the app
module.exports = new SmsService();
