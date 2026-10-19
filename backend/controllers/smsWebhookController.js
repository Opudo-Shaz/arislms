const logger = require('../config/logger');
const smsService = require('../services/sms/SmsService');
const smsWebhookService = require('../services/sms/smsWebhookService');
const PingAfricaSmsProvider = require('../services/sms/providers/PingAfricaSmsProvider');
const { getUserId } = require('../utils/helpers');

const WEBHOOK_PATH = '/api/webhooks/sms/ping-africa';

function isHttpUrl(value) {
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
}

// Gateway 404/validation errors pass through as 404/400; anything else is a bad-gateway.
function sendGatewayError(res, error, action) {
  logger.error(`[smsWebhook] ${action} failed: ${error.message}`);
  const status = error.statusCode === 404 ? 404 : error.statusCode === 422 || error.statusCode === 400 ? 400 : 502;
  return res.status(status).json({ success: false, message: error.message });
}

let badSignatureLimiter = null;

const smsWebhookController = {
  setBadSignatureLimiter(limiter) {
    badSignatureLimiter = limiter;
  },

  /** POST /api/webhooks/sms/ping-africa — public; authenticated by HMAC signature. Body is the raw Buffer. */
  async receivePingAfrica(req, res) {
    try {
      const result = await smsWebhookService.handlePingAfrica(req.body, req.headers);
      return res.status(200).json({ success: true, status: result.status });
    } catch (error) {
      if (error instanceof smsWebhookService.WebhookError) {
        if (error.statusCode === 401) badSignatureLimiter?.recordFailure(req);
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      // 5xx makes the gateway retry (30s → 2min → 10min).
      logger.error(`[smsWebhook] Ping Africa webhook failed: ${error.message}`);
      return res.status(500).json({ success: false, message: 'Webhook processing failed' });
    }
  },

  /** GET /api/sms-providers/ping-africa/webhook — endpoints registered on the Ping Africa account. */
  async listPingAfricaWebhooks(req, res) {
    try {
      const provider = await smsService.getPingAfricaProvider();
      const endpoints = await smsWebhookService.listPingAfricaWebhooks(provider);
      return res.status(200).json({ success: true, data: { endpoints } });
    } catch (error) {
      return sendGatewayError(res, error, 'list endpoints');
    }
  },

  /** GET /api/sms-providers/ping-africa/webhook/:id */
  async getPingAfricaWebhook(req, res) {
    try {
      const provider = await smsService.getPingAfricaProvider();
      const data = await smsWebhookService.getPingAfricaWebhook(provider, req.params.id);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return sendGatewayError(res, error, 'get endpoint');
    }
  },

  /** POST /api/sms-providers/ping-africa/webhook — register with Ping Africa and store the signing secret. */
  async registerPingAfricaWebhook(req, res) {
    try {
      const base = process.env.API_PUBLIC_URL && process.env.API_PUBLIC_URL.replace(/\/+$/, '');
      const url = req.body?.url || (base ? `${base}${WEBHOOK_PATH}` : null);
      if (!isHttpUrl(url)) {
        return res.status(400).json({
          success: false,
          message: 'A valid public webhook URL is required (send "url" or set API_PUBLIC_URL).',
        });
      }

      const provider = await smsService.getPingAfricaProvider();
      const data = await smsWebhookService.registerPingAfricaWebhook(provider, new URL(url).toString(), getUserId(req));
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return sendGatewayError(res, error, 'register endpoint');
    }
  },

  /** PUT /api/sms-providers/ping-africa/webhook/:id — change url, events, description or active flag. */
  async updatePingAfricaWebhook(req, res) {
    try {
      const { url, events, description, is_active: isActive } = req.body || {};
      const changes = {};

      if (url !== undefined) {
        if (!isHttpUrl(url)) return res.status(400).json({ success: false, message: 'url must be a valid http(s) URL' });
        changes.url = new URL(url).toString();
      }
      if (events !== undefined) {
        const valid = Array.isArray(events) && events.length > 0 && events.every((e) => PingAfricaSmsProvider.WEBHOOK_EVENTS.includes(e));
        if (!valid) {
          return res.status(400).json({
            success: false,
            message: `events must be a non-empty array of: ${PingAfricaSmsProvider.WEBHOOK_EVENTS.join(', ')}`,
          });
        }
        changes.events = events;
      }
      if (description !== undefined) {
        if (description !== null && (typeof description !== 'string' || description.length > 255)) {
          return res.status(400).json({ success: false, message: 'description must be a string of at most 255 characters' });
        }
        changes.description = description;
      }
      if (isActive !== undefined) {
        if (typeof isActive !== 'boolean') return res.status(400).json({ success: false, message: 'is_active must be a boolean' });
        changes.is_active = isActive;
      }
      if (Object.keys(changes).length === 0) {
        return res.status(400).json({ success: false, message: 'Provide at least one of: url, events, description, is_active' });
      }

      const provider = await smsService.getPingAfricaProvider();
      const data = await smsWebhookService.updatePingAfricaWebhook(provider, req.params.id, changes);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return sendGatewayError(res, error, 'update endpoint');
    }
  },

  /** DELETE /api/sms-providers/ping-africa/webhook/:id — delete on Ping Africa; clears our secret if it was the active one. */
  async deletePingAfricaWebhook(req, res) {
    try {
      const provider = await smsService.getPingAfricaProvider();
      const data = await smsWebhookService.deletePingAfricaWebhook(provider, req.params.id, getUserId(req));
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return sendGatewayError(res, error, 'delete endpoint');
    }
  },
};

module.exports = smsWebhookController;
