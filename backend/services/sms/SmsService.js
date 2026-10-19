const logger = require('../../config/logger');
const StubSmsProvider = require('./providers/StubSmsProvider');
const PingAfricaSmsProvider = require('./providers/PingAfricaSmsProvider');
const systemConfigService = require('../systemConfigService');
const smsMessageService = require('./smsMessageService');

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

  /** Build the Ping Africa provider from System Config (throws if the token is missing). */
  async getPingAfricaProvider() {
    const getVal = (key) => systemConfigService.getConfigValue(key, 'string', null);
    return new PingAfricaSmsProvider({
      apiToken: await getVal('sms.provider.ping-africa.api_token'),
      senderId: await getVal('sms.provider.ping-africa.sender_id'),
      baseUrl: await getVal('sms.provider.ping-africa.base_url'),
    });
  }

  async _resolveProvider() {
    if (this._provider) return this._provider;

    const providerName = await systemConfigService.getConfigValue('sms.provider', 'string', 'stub');
    logger.info(`[SmsService] Resolving SMS provider: ${providerName}`);

    if (providerName === 'ping-africa') {
      this._provider = await this.getPingAfricaProvider();
      return this._provider;
    }

    // Unknown provider names fall back to the stub so notifications never crash
    // the app — they just fail with a clear error.
    this._provider = new StubSmsProvider();
    return this._provider;
  }

  /**
   * Send an SMS using the configured provider. The send is also recorded in
   * sms_messages so delivery webhooks can update its status.
   * @param {object} opts
   * @param {string} opts.to   - Recipient phone number
   * @param {string} opts.body - Message text
   * @param {number} [opts.outboxId] - notification_outbox row this SMS belongs to
   */
  async send({ to, body, outboxId = null }) {
    try {
      const provider = await this._resolveProvider();
      const result = await provider.send({ to, body });
      const providerName = provider.constructor.providerName;
      if (providerName) await smsMessageService.recordSent({ provider: providerName, to, result, outboxId });
      return result;
    } catch (err) {
      this._provider = null;
      logger.error(`[SmsService] send failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Send the same SMS to many recipients using the configured provider.
   * Bulk sends are queued by the gateway; per-recipient status arrives via
   * delivery webhooks, matched by batch id + recipient.
   * @param {object} opts
   * @param {string[]} opts.recipients - Recipient phone numbers
   * @param {string} opts.body         - Message text
   */
  async sendBulk({ recipients, body }) {
    let provider;
    try {
      provider = await this._resolveProvider();
      const batches = await provider.sendBulk({ recipients, body });
      await this._recordBatches(provider, batches);
      return batches;
    } catch (err) {
      // Batches accepted before a later batch failed are already out — still track them.
      if (provider && err.partialResults?.length) await this._recordBatches(provider, err.partialResults);
      this._provider = null;
      logger.error(`[SmsService] sendBulk failed: ${err.message}`);
      throw err;
    }
  }

  async _recordBatches(provider, batches) {
    const providerName = provider.constructor.providerName;
    if (providerName) await smsMessageService.recordBatches({ provider: providerName, batches });
  }

  /** Bust the cached provider instance. Call after updating sms.* system configs. */
  resetProvider() {
    this._provider = null;
    logger.info('[SmsService] Provider cache cleared');
  }
}

// Singleton — shared across the app
module.exports = new SmsService();
