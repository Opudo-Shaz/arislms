const express = require('express');
const controller = require('../controllers/smsWebhookController');
const { authenticate, requirePermission } = require('../middleware/authMiddleware');

// Admin tooling for SMS gateway integrations.
const router = express.Router();

// Ping Africa endpoint ids are UUIDs; reject anything else before it reaches the gateway URL.
const validateEndpointId = (req, res, next) => {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid id' });
  }
  next();
};

/**
 * @openapi
 * components:
 *   schemas:
 *     PingAfricaWebhookEndpoint:
 *       type: object
 *       description: A delivery-receipt webhook endpoint registered on the Ping Africa account. The signing secret is never returned.
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         url:
 *           type: string
 *           format: uri
 *         description:
 *           type: string
 *           nullable: true
 *         events:
 *           type: array
 *           items:
 *             type: string
 *             enum: [sms.sent, sms.delivered, sms.failed]
 *         is_active:
 *           type: boolean
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         usedByThisSystem:
 *           type: boolean
 *           description: True when this endpoint's signing secret is the one stored in System Config (sms.provider.ping-africa.webhook_secret).
 */

/**
 * @openapi
 * /api/sms-providers/ping-africa/webhook:
 *   get:
 *     summary: List Ping Africa webhook endpoints
 *     description: Requires `system_config:read`. Calls the Ping Africa API using the token in System Config.
 *     tags:
 *       - SMS Providers
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Registered webhook endpoints
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     endpoints:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PingAfricaWebhookEndpoint'
 *       502:
 *         description: Ping Africa unreachable, rejected the request, or the API token is not configured
 *   post:
 *     summary: Register the delivery-receipt webhook with Ping Africa
 *     description: |
 *       Requires `system_config:update`. Registers the URL for the `sms.sent`, `sms.delivered` and
 *       `sms.failed` events and stores the returned signing secret (encrypted) in the
 *       `sms.provider.ping-africa.webhook_secret` system config. If `url` is omitted it defaults to
 *       `<API_PUBLIC_URL>/api/webhooks/sms/ping-africa`.
 *     tags:
 *       - SMS Providers
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 example: https://api.example.com/api/webhooks/sms/ping-africa
 *     responses:
 *       201:
 *         description: Webhook registered and secret stored
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     endpointId:
 *                       type: string
 *                     url:
 *                       type: string
 *                     events:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: No valid URL supplied and API_PUBLIC_URL is not set
 *       502:
 *         description: Ping Africa unreachable, rejected the request, or the API token is not configured
 */
router.get('/ping-africa/webhook', authenticate, requirePermission('system_config:read'), controller.listPingAfricaWebhooks);
router.post('/ping-africa/webhook', authenticate, requirePermission('system_config:update'), controller.registerPingAfricaWebhook);

/**
 * @openapi
 * /api/sms-providers/ping-africa/webhook/{id}:
 *   get:
 *     summary: Get one Ping Africa webhook endpoint
 *     description: Requires `system_config:read`.
 *     tags:
 *       - SMS Providers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Webhook endpoint
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PingAfricaWebhookEndpoint'
 *       400:
 *         description: Invalid id
 *       404:
 *         description: Endpoint not found on Ping Africa
 *       502:
 *         description: Ping Africa unreachable or rejected the request
 *   put:
 *     summary: Update a Ping Africa webhook endpoint
 *     description: |
 *       Requires `system_config:update`. Change the URL, subscribed events, description or active flag.
 *       The signing secret is unchanged, so no System Config update is needed.
 *     tags:
 *       - SMS Providers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: At least one property is required.
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *               events:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                   enum: [sms.sent, sms.delivered, sms.failed]
 *               description:
 *                 type: string
 *                 maxLength: 255
 *                 nullable: true
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated webhook endpoint
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PingAfricaWebhookEndpoint'
 *       400:
 *         description: Invalid id or body
 *       404:
 *         description: Endpoint not found on Ping Africa
 *       502:
 *         description: Ping Africa unreachable or rejected the request
 *   delete:
 *     summary: Delete a Ping Africa webhook endpoint
 *     description: |
 *       Requires `system_config:delete`. Deletes the endpoint on Ping Africa. If it is the endpoint
 *       whose secret is stored in System Config, that secret is cleared too, and incoming webhooks are
 *       rejected (503) until a new endpoint is registered.
 *     tags:
 *       - SMS Providers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Endpoint deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     deleted:
 *                       type: boolean
 *                     secretCleared:
 *                       type: boolean
 *       400:
 *         description: Invalid id
 *       404:
 *         description: Endpoint not found on Ping Africa
 *       502:
 *         description: Ping Africa unreachable or rejected the request
 */
router.get('/ping-africa/webhook/:id', authenticate, requirePermission('system_config:read'), validateEndpointId, controller.getPingAfricaWebhook);
router.put('/ping-africa/webhook/:id', authenticate, requirePermission('system_config:update'), validateEndpointId, controller.updatePingAfricaWebhook);
router.delete('/ping-africa/webhook/:id', authenticate, requirePermission('system_config:delete'), validateEndpointId, controller.deletePingAfricaWebhook);

module.exports = router;
