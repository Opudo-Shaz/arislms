const crypto = require('node:crypto');
const logger = require('../../config/logger');
const sequelize = require('../../config/sequalize_db');
const SmsWebhookEvent = require('../../models/smsWebhookEventModel');
const SystemConfig = require('../../models/systemConfigModel');
const systemConfigService = require('../systemConfigService');
const smsMessageService = require('./smsMessageService');
const PingAfricaSmsProvider = require('./providers/PingAfricaSmsProvider');

const PROVIDER = PingAfricaSmsProvider.providerName;
const SECRET_KEY = 'sms.provider.ping-africa.webhook_secret';

class WebhookError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

/** Strip the signing secret from a gateway endpoint; flag the one whose secret this system holds. */
function toPublicEndpoint({ secret, ...rest }, storedSecret) {
  return { ...rest, usedByThisSystem: Boolean(secret && storedSecret && secret === storedSecret) };
}

const getStoredSecret = () => systemConfigService.getConfigValue(SECRET_KEY, 'string', null);

async function setStoredSecret(value, actorId) {
  const config = await SystemConfig.findOne({ where: { key: SECRET_KEY } });
  if (!config) throw new Error(`System config ${SECRET_KEY} not found — run the "system-config" seeder`);
  await systemConfigService.update(config.id, { value }, actorId, 'sms-webhook-registration');
}

const smsWebhookService = {
  WebhookError,

  async listPingAfricaWebhooks(provider) {
    const [endpoints, storedSecret] = await Promise.all([provider.listWebhookEndpoints(), getStoredSecret()]);
    // The list response has no secrets; only the per-endpoint GET does, and accounts have few endpoints.
    return Promise.all(
      endpoints.map(async (e) => toPublicEndpoint(e.secret ? e : await provider.getWebhookEndpoint(e.id), storedSecret))
    );
  },

  async getPingAfricaWebhook(provider, id) {
    const [endpoint, storedSecret] = await Promise.all([provider.getWebhookEndpoint(id), getStoredSecret()]);
    return toPublicEndpoint(endpoint, storedSecret);
  },

  async updatePingAfricaWebhook(provider, id, changes) {
    await provider.updateWebhookEndpoint(id, changes);
    // Re-read so the response always reflects the stored state (and flags usedByThisSystem).
    return this.getPingAfricaWebhook(provider, id);
  },

  /** Delete an endpoint; if it is the one we verify with, also clear the stored secret. */
  async deletePingAfricaWebhook(provider, id, actorId) {
    const [endpoint, storedSecret] = await Promise.all([provider.getWebhookEndpoint(id), getStoredSecret()]);
    const wasInUse = Boolean(endpoint.secret && storedSecret && endpoint.secret === storedSecret);

    await provider.deleteWebhookEndpoint(id);
    if (wasInUse) await setStoredSecret('', actorId);
    return { deleted: true, secretCleared: wasInUse };
  },

  /**
   * Verify and apply a Ping Africa delivery webhook.
   * @param {Buffer} rawBody - exact bytes received (the signature covers them)
   * @param {object} headers - request headers (lower-cased by Node)
   * @returns {Promise<{status: 'processed'|'duplicate'|'unmatched'|'ignored'}>}
   */
  async handlePingAfrica(rawBody, headers) {
    const secret = await systemConfigService.getConfigValue(SECRET_KEY, 'string', null);
    if (!secret) throw new WebhookError(503, 'Webhook secret is not configured');

    if (!PingAfricaSmsProvider.verifySignature(rawBody, headers['x-webhook-signature'], secret)) {
      logger.warn('[smsWebhookService] Ping Africa webhook rejected: invalid signature');
      throw new WebhookError(401, 'Invalid signature');
    }

    let body;
    try {
      body = JSON.parse(rawBody.toString('utf8'));
    } catch {
      logger.warn(`[smsWebhookService] Ping Africa webhook with invalid JSON: ${rawBody.toString('utf8').slice(0, 300)}`);
      throw new WebhookError(400, 'Invalid JSON payload');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new WebhookError(400, 'Payload must be a JSON object');
    }

    const event = body.event || headers['x-webhook-event'];
    const data = body.data && typeof body.data === 'object' ? body.data : {};

    // Anything that isn't a delivery event (e.g. the dashboard's "test webhook" ping) is
    // acknowledged with 2xx so the gateway doesn't count it as a failure and disable the endpoint.
    if (!PingAfricaSmsProvider.WEBHOOK_EVENTS.includes(event)) {
      logger.info(`[smsWebhookService] Ping Africa webhook acknowledged but ignored: event=${event} body=${rawBody.toString('utf8').slice(0, 300)}`);
      return { status: 'ignored' };
    }

    // Normally the gateway supplies a unique delivery id; if it is ever missing, a hash of the
    // exact body still de-duplicates identical retries.
    const deliveryId =
      headers['x-webhook-delivery-id'] || `body-${crypto.createHash('sha256').update(rawBody).digest('hex').slice(0, 48)}`;

    const recipient = smsMessageService.toRecipient(data.recipient);
    const batchId = data.batch_id ? String(data.batch_id) : null;
    const messageId = data.message_id ? String(data.message_id) : null;

    return sequelize.transaction(async (transaction) => {
      const [record, created] = await SmsWebhookEvent.findOrCreate({
        where: { provider: PROVIDER, deliveryId: String(deliveryId) },
        defaults: {
          provider: PROVIDER,
          deliveryId: String(deliveryId),
          event,
          providerMessageId: messageId,
          batchId,
          recipient,
          payload: body,
          eventTimestamp: smsMessageService.toDate(body.timestamp),
          matched: false,
        },
        transaction,
      });

      // Gateway retry of an event we already applied.
      if (!created && record.matched) return { status: 'duplicate' };

      const message = await smsMessageService.findMessage(PROVIDER, { messageId, batchId, recipient });
      if (!message) {
        logger.warn(`[smsWebhookService] No SMS found for ${event} message_id=${messageId} batch_id=${batchId}; kept for reconciliation`);
        return { status: 'unmatched' };
      }

      await smsMessageService.applyEvent(message, { event, timestamp: body.timestamp, data });
      await record.update({ matched: true }, { transaction });
      return { status: 'processed' };
    });
  },

  /**
   * Register this API's webhook URL with Ping Africa and store the returned
   * signing secret in System Config (encrypted).
   * @param {PingAfricaSmsProvider} provider
   * @param {string} url - public HTTPS URL Ping Africa should POST to
   * @param {number} actorId
   */
  async registerPingAfricaWebhook(provider, url, actorId) {
    const endpoint = await provider.registerWebhookEndpoint({ url });
    if (!endpoint.secret) {
      throw new Error('Ping Africa did not return a webhook signing secret');
    }

    await setStoredSecret(endpoint.secret, actorId);

    return { endpointId: endpoint.id, url, events: PingAfricaSmsProvider.WEBHOOK_EVENTS };
  },

  SECRET_KEY,
};

module.exports = smsWebhookService;
