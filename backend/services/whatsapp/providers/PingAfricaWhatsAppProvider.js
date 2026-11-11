const logger = require('../../../config/logger');
const PingAfricaSmsProvider = require('../../sms/providers/PingAfricaSmsProvider');
const { normalizePhone } = require('../../../utils/phone');

const MAX_MESSAGE_LENGTH = 4096;

/**
 * Ping Africa WhatsApp provider (https://bulk.ping.africa/docs/api.json).
 *
 * Shares the bearer token and base URL of the Ping Africa SMS provider (same
 * account), and sends through a WhatsApp instance connected on that account:
 *   POST /whatsapp/messages/text   { instanceName, number, text }
 *   POST /whatsapp/messages/media  { instanceName, number, mediatype, media, caption?, fileName? }
 *   GET  /whatsapp/instances/{instanceName}
 */
class PingAfricaWhatsAppProvider extends PingAfricaSmsProvider {
  static get providerName() { return 'ping-africa'; }

  /**
   * @param {object} config
   * @param {string}  config.apiToken     - Ping Africa API token
   * @param {string}  config.instanceName - Connected WhatsApp instance to send from
   * @param {string} [config.baseUrl]     - API base URL
   */
  constructor({ apiToken, instanceName, baseUrl }) {
    if (!apiToken) {
      throw new Error(
        'Ping Africa API token is not configured. Set sms.provider.ping-africa.api_token in System Config.'
      );
    }
    if (!instanceName) {
      throw new Error(
        'Ping Africa WhatsApp instance is not configured. Set whatsapp.provider.ping-africa.instance_name in System Config.'
      );
    }
    super({ apiToken, baseUrl });
    this.instanceName = instanceName;
  }

  /** WhatsApp numbers are E.164 digits without the leading '+'. */
  _toWhatsAppNumber(to) {
    const normalized = normalizePhone(to);
    if (normalized) return normalized.replace(/^\+/, '');
    return String(to).replace(/\D/g, '');
  }

  /**
   * Send one WhatsApp text message.
   * @param {object} opts
   * @param {string} opts.to
   * @param {string} opts.body
   */
  async send({ to, body }) {
    if (!to) throw new Error('WhatsApp recipient is required');
    if (!body || !String(body).trim()) throw new Error('WhatsApp message body is empty');
    if (String(body).length > MAX_MESSAGE_LENGTH) {
      throw new Error(`WhatsApp message exceeds ${MAX_MESSAGE_LENGTH} characters`);
    }

    const number = this._toWhatsAppNumber(to);
    if (!number) throw new Error('WhatsApp recipient is not a valid phone number');

    const data = await this._request('POST', '/whatsapp/messages/text', {
      instanceName: this.instanceName,
      number,
      text: body,
    });
    logger.info(`[PingAfricaWhatsAppProvider] WhatsApp sent instance=${this.instanceName} to=${number}`);
    return {
      providerMessageId: data.key?.id || data.message?.id || data.id || null,
      status: data.status || data.message?.status || 'sent',
      raw: data,
    };
  }

  /**
   * Send an image, video, audio or document.
   * @param {object} opts
   * @param {string} opts.to
   * @param {'image'|'video'|'audio'|'document'} opts.mediaType
   * @param {string} opts.media - Public URL or base64 payload
   * @param {string} [opts.caption]
   * @param {string} [opts.fileName]
   */
  async sendMedia({ to, mediaType, media, caption, fileName }) {
    if (!to) throw new Error('WhatsApp recipient is required');
    if (!media) throw new Error('WhatsApp media is required');

    const number = this._toWhatsAppNumber(to);
    if (!number) throw new Error('WhatsApp recipient is not a valid phone number');

    const data = await this._request('POST', '/whatsapp/messages/media', {
      instanceName: this.instanceName,
      number,
      mediatype: mediaType,
      media,
      caption: caption || null,
      fileName: fileName || null,
    });
    return { providerMessageId: data.key?.id || data.message?.id || data.id || null, status: data.status || 'sent', raw: data };
  }

  /** Fetch the configured instance (used to check it exists and is connected). */
  async getInstance() {
    return this._request('GET', `/whatsapp/instances/${encodeURIComponent(this.instanceName)}`);
  }
}

module.exports = PingAfricaWhatsAppProvider;
