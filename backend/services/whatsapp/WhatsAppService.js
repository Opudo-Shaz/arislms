const logger = require('../../config/logger');
const PingAfricaWhatsAppProvider = require('./providers/PingAfricaWhatsAppProvider');
const systemConfigService = require('../systemConfigService');

/**
 * WhatsAppService — builds the Ping Africa WhatsApp provider from SystemConfig and sends through it.
 * Mirrors services/sms/SmsService.js.
 *
 * Configs:
 *   sms.provider.ping-africa.api_token / base_url — shared Ping Africa credentials
 *   whatsapp.provider.ping-africa.instance_name  — connected WhatsApp instance to send from
 *
 * The provider is rebuilt on every send (config reads are cached by systemConfigService),
 * so config changes take effect immediately.
 */
class WhatsAppService {
  async _resolveProvider() {
    const getVal = (key) => systemConfigService.getConfigValue(key, 'string', null);
    return new PingAfricaWhatsAppProvider({
      apiToken: await getVal('sms.provider.ping-africa.api_token'),
      instanceName: await getVal('whatsapp.provider.ping-africa.instance_name'),
      baseUrl: await getVal('sms.provider.ping-africa.base_url'),
    });
  }

  /**
   * @param {object} opts
   * @param {string} opts.to   - Recipient phone number
   * @param {string} opts.body - Message text
   */
  async send({ to, body }) {
    try {
      const provider = await this._resolveProvider();
      return await provider.send({ to, body });
    } catch (err) {
      logger.error(`[WhatsAppService] send failed: ${err.message}`);
      throw err;
    }
  }
}

module.exports = new WhatsAppService();
