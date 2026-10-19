const crypto = require('node:crypto');
const logger = require('../../../config/logger');
const { normalizePhone } = require('../../../utils/phone');

const DEFAULT_BASE_URL = 'https://bulk.ping.africa/api';
const REQUEST_TIMEOUT_MS = 15000;
const MAX_MESSAGE_LENGTH = 1600;
const MAX_BULK_RECIPIENTS = 1000;
const WEBHOOK_EVENTS = ['sms.sent', 'sms.delivered', 'sms.failed'];

/**
 * Ping Africa SMS provider (https://bulk.ping.africa/docs/api.json).
 *
 * Auth: bearer API token generated in the Ping Africa dashboard.
 *   POST /sms/send       { recipient, message, sender_id? }
 *   POST /sms/send-bulk  { recipients[<=1000], message, sender_id? }
 *
 * Delivery receipts arrive as signed webhooks (sms.sent / sms.delivered / sms.failed);
 * see services/sms/smsWebhookService.js. Single sends return message.id (= webhook
 * message_id). Bulk sends are queued asynchronously and return only a batch_id, so
 * their messages are matched by batch_id + recipient.
 */
class PingAfricaSmsProvider {
  static get providerName() { return 'ping-africa'; }
  static get WEBHOOK_EVENTS() { return WEBHOOK_EVENTS; }

  /**
   * Verify an `X-Webhook-Signature` header (`sha256=<hex HMAC-SHA256 of raw body>`).
   * @param {Buffer|string} rawBody
   * @param {string} signatureHeader
   * @param {string} secret
   */
  static verifySignature(rawBody, signatureHeader, secret) {
    if (!rawBody || !signatureHeader || !secret) return false;
    const actual = String(signatureHeader).replace(/^sha256=/, '');
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(actual);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

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

    const data = await this._request('POST', '/sms/send', payload);
    logger.info(
      `[PingAfricaSmsProvider] SMS sent to=${recipient} status=${data.message?.status} parts=${data.message?.parts} credits=${data.credits_charged}`
    );
    return {
      providerMessageId: data.message?.id || null,
      status: data.message?.status || 'sent',
      parts: data.message?.parts ?? null,
      cost: data.credits_charged ?? null,
      raw: data,
    };
  }

  /**
   * Send the same SMS to many recipients (auto-chunked into batches of 1000).
   * @param {object} opts
   * @param {string[]} opts.recipients
   * @param {string} opts.body
   * @returns {Promise<{batchId: string|null, recipients: string[], status: string, raw: object}[]>}
   *   one entry per batch of up to 1000 recipients
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

      let data;
      try {
        data = await this._request('POST', '/sms/send-bulk', payload);
      } catch (err) {
        err.partialResults = results;
        throw err;
      }
      logger.info(`[PingAfricaSmsProvider] Bulk SMS submitted recipients=${batch.length}`);
      results.push({ batchId: data.batch_id || null, recipients: batch, status: data.status || 'processing', raw: data });
    }
    return results;
  }

  async _request(method, path, payload) {
    let res;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: payload ? JSON.stringify(payload) : undefined,
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
      const err = new Error(`Ping Africa API error (${res.status}): ${reason}`);
      err.statusCode = res.status;
      throw err;
    }
    return data || {};
  }

  /**
   * List webhook endpoints registered on the Ping Africa account.
   * Includes each endpoint's signing secret when the API returns it; callers must not expose it.
   */
  async listWebhookEndpoints() {
    const data = await this._request('GET', '/webhooks/endpoints');
    return Array.isArray(data.data) ? data.data : [];
  }

  /** Get one webhook endpoint (includes the signing secret; callers must not expose it). */
  async getWebhookEndpoint(id) {
    const data = await this._request('GET', `/webhooks/endpoints/${encodeURIComponent(id)}`);
    return data.data || data.endpoint || data;
  }

  /**
   * Update a webhook endpoint's url, events, description or active flag.
   * @param {string} id
   * @param {{url?: string, events?: string[], description?: string|null, is_active?: boolean}} changes
   */
  async updateWebhookEndpoint(id, changes) {
    const data = await this._request('PUT', `/webhooks/endpoints/${encodeURIComponent(id)}`, changes);
    return data.data || data.endpoint || data;
  }

  /** Permanently delete a webhook endpoint. */
  async deleteWebhookEndpoint(id) {
    await this._request('DELETE', `/webhooks/endpoints/${encodeURIComponent(id)}`);
  }

  /**
   * Register a webhook endpoint. The response includes the generated signing secret.
   * @param {object} opts
   * @param {string} opts.url
   * @param {string[]} [opts.events]
   * @param {string} [opts.description]
   * @returns {Promise<{id: *, secret: string|null, raw: object}>}
   */
  async registerWebhookEndpoint({ url, events = WEBHOOK_EVENTS, description = 'ARISLMS delivery receipts' }) {
    const data = await this._request('POST', '/webhooks/endpoints', { url, events, description });
    const endpoint = data.data || data.endpoint || data;
    return { id: endpoint.id ?? null, secret: endpoint.secret ?? null, raw: data };
  }
}

module.exports = PingAfricaSmsProvider;
