const express = require('express');
const controller = require('../controllers/smsWebhookController');
const { failureLimiter } = require('../utils/rateLimiter');

/**
 * Public SMS gateway callbacks. Mounted BEFORE express.json() in server.js:
 * the HMAC signature covers the exact bytes received, so the body is kept raw.
 */
const router = express.Router();

/**
 * @openapi
 * /api/webhooks/sms/ping-africa:
 *   post:
 *     summary: Ping Africa delivery-receipt webhook (called by Ping Africa)
 *     description: |
 *       Public endpoint, authenticated by an HMAC-SHA256 signature of the raw body using the secret in
 *       `sms.provider.ping-africa.webhook_secret`. Not for manual use; register it via
 *       `POST /api/sms-providers/ping-africa/webhook`. Duplicate deliveries (same
 *       `X-Webhook-Delivery-Id`) are acknowledged without being re-applied. A 5xx response makes
 *       Ping Africa retry. Bodies over 16 KB are rejected, and an IP with 20 bad signatures in
 *       15 minutes gets 429 until the window expires.
 *     tags:
 *       - SMS Providers
 *     parameters:
 *       - in: header
 *         name: X-Webhook-Signature
 *         required: true
 *         schema:
 *           type: string
 *           example: sha256=<hex hmac of body>
 *       - in: header
 *         name: X-Webhook-Delivery-Id
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: X-Webhook-Event
 *         schema:
 *           type: string
 *           enum: [sms.sent, sms.delivered, sms.failed]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *                 enum: [sms.sent, sms.delivered, sms.failed]
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *               data:
 *                 type: object
 *                 properties:
 *                   message_id:
 *                     type: string
 *                   provider_message_id:
 *                     type: string
 *                   recipient:
 *                     type: string
 *                   sender_id:
 *                     type: string
 *                   status:
 *                     type: string
 *                   delivered_at:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *                   failed_at:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *                   failure_reason:
 *                     type: string
 *                     nullable: true
 *                   parts:
 *                     type: integer
 *                   cost:
 *                     type: string
 *                   batch_id:
 *                     type: string
 *                     nullable: true
 *     responses:
 *       200:
 *         description: Acknowledged (`status` is processed, duplicate or unmatched)
 *       400:
 *         description: Malformed payload or missing headers
 *       401:
 *         description: Invalid signature
 *       429:
 *         description: Too many failed signature attempts from this IP
 *       503:
 *         description: Webhook secret not configured
 */

// Only bad-signature attempts count, so legitimate delivery-receipt bursts are never throttled.
// Per-IP assumes TRUST_PROXY is set when running behind a load balancer.
const badSignatureLimiter = failureLimiter({ name: 'smsWebhookBadSignature', windowMs: 15 * 60 * 1000, max: 20 });
controller.setBadSignatureLimiter(badSignatureLimiter);

// Real payloads are well under 2 KB; the guard runs first so blocked IPs never get their body read.
router.post(
  '/ping-africa',
  badSignatureLimiter.guard,
  express.raw({ type: () => true, limit: '16kb' }),
  controller.receivePingAfrica
);

module.exports = router;
