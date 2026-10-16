const express = require('express');
const controller = require('../controllers/clientRegistrationLinkController');
const { authenticate, requirePermission } = require('../middleware/authMiddleware');
const { validateIdParam } = require('../middleware/validateIdParam');

const router = express.Router();

/**
 * @openapi
 * /api/client-registration-links:
 *   get:
 *     summary: List client registration links with usage counts
 *     tags: [Client Registration Links]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, expired, revoked] }
 *     responses:
 *       200:
 *         description: List of links
 *   post:
 *     summary: Generate a client registration link, optionally sending it to emails/phone numbers
 *     tags: [Client Registration Links]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           example:
 *             label: Nairobi branch drive
 *             recipients: ["jane@example.com", "0712345678"]
 *     responses:
 *       201:
 *         description: Link created; the response carries the shareable URL
 */
router.get('/', authenticate, requirePermission('client_registration_links:read'), controller.listLinks);
router.post('/', authenticate, requirePermission('client_registration_links:create'), controller.createLink);

/**
 * @openapi
 * /api/client-registration-links/{id}:
 *   get:
 *     summary: Get a link and the clients who registered through it
 *     tags: [Client Registration Links]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Link detail
 */
router.get('/:id', authenticate, requirePermission('client_registration_links:read'), validateIdParam(), controller.getLink);

// The URL embeds the secret token, so it is gated by update rather than read.
router.get('/:id/url', authenticate, requirePermission('client_registration_links:update'), validateIdParam(), controller.getLinkUrl);
router.post('/:id/revoke', authenticate, requirePermission('client_registration_links:update'), validateIdParam(), controller.revokeLink);

module.exports = router;
