const logger = require('../../../config/logger');
const { normalizePhone } = require('../../../utils/phone');

const DEFAULT_BASE_URL = 'https://bulk.ping.africa/api';
const REQUEST_TIMEOUT_MS = 15000;
const MAX_MESSAGE_LENGTH = 1600;
const MAX_BULK_RECIPIENTS = 1000;

/**
 * Ping Africa SMS provider (https://bulk.ping.africa/docs/api.json).
 *
 * Auth: bearer API token generated in the Ping Africa dashboard.
 *   POST /sms/send       { recipient, message, sender_id? }
 *   POST /sms/send-bulk  { recipients[<=1000], message, sender_id? }
 *
 * Delivery receipts are available via webhooks (events sms.sent / sms.delivered /
 * sms.failed, HMAC-SHA256 signed) but are not consumed yet.
 */
class PingAfricaSmsProvider {
  /**
   * @param {object} config
   * @param {string}  config.apiToken   - Ping Africa API token
   * @param {string} [config.senderId]  - Sender ID (max 11 chars); omitted = account default
   * @param {string} [config.baseUrl]   - API base URL
   */
  constructor({ apiToken, senderId, baseUrl }) {
    if (!apiToken) {
      throw new Error(
        'Ping Africa API token is not configured. Set sms.provider.ping-africa.api_token in System Config.'
      );
    }
    this.apiToken = apiToken;
    this.senderId = senderId || null;
    this.baseUrl = String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  async _post(path, payload) {
    let res;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new Error(`Ping Africa request failed: ${err.message}`);
    }

    const data = await res.json().catch(() => null);

    if (!res.ok || (data && data.success === false)) {
      const reason =
        (data && (data.error || data.message?.error || (typeof data.message === 'string' && data.message))) ||
        `HTTP ${res.status}`;
      throw new Error(`Ping Africa API error (${res.status}): ${reason}`);
    }
    return data || {};
  }

  _assertMessage(body) {
    if (!body || !String(body).trim()) throw new Error('SMS body is empty');
    if (String(body).length > MAX_MESSAGE_LENGTH) {
      throw new Error(`SMS body exceeds ${MAX_MESSAGE_LENGTH} characters`);
    }
  }

  _toRecipient(to) {
    return normalizePhone(to) || String(to).trim();
  }

  /**
   * Send one SMS.
   * @param {object} opts
   * @param {string} opts.to
   * @param {string} opts.body
   */
  async send({ to, body }) {
    if (!to) throw new Error('SMS recipient is required');
    this._assertMessage(body);

    const recipient = this._toRecipient(to);
    const payload = { recipient, message: body };
    if (this.senderId) payload.sender_id = this.senderId;

    const data = await this._post('/sms/send', payload);
    logger.info(
      `[PingAfricaSmsProvider] SMS sent to=${recipient} status=${data.message?.status} parts=${data.message?.parts} credits=${data.credits_charged}`
    );
    return data;
  }

  /**
   * Send the same SMS to many recipients (auto-chunked into batches of 1000).
   * @param {object} opts
   * @param {string[]} opts.recipients
   * @param {string} opts.body
   * @returns {Promise<object[]>} one API response per batch
   */
  async sendBulk({ recipients, body }) {
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('At least one SMS recipient is required');
    }
    this._assertMessage(body);

    const unique = [...new Set(recipients.filter(Boolean).map((r) => this._toRecipient(r)))];
    const results = [];

    for (let i = 0; i < unique.length; i += MAX_BULK_RECIPIENTS) {
      const batch = unique.slice(i, i + MAX_BULK_RECIPIENTS);
      const payload = { recipients: batch, message: body };
      if (this.senderId) payload.sender_id = this.senderId;

      const data = await this._post('/sms/send-bulk', payload);
      logger.info(`[PingAfricaSmsProvider] Bulk SMS submitted recipients=${batch.length}`);
      results.push(data);
    }
    return results;
  }
}

module.exports = PingAfricaSmsProvider;
