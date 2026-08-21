const express = require('express');
const {
  createInvitation,
  listInvitations,
  resendInvitation,
  revokeInvitation,
  verifyInvitation,
  acceptInvitation,
} = require('../controllers/invitationController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validateIdParam } = require('../middleware/validateIdParam');

const router = express.Router();

/**
 * @openapi
 * /api/invitations:
 *   get:
 *     summary: List invitations
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [pending, accepted, expired, revoked]
 *         description: Optional invitation status filter
 *     responses:
 *       200:
 *         description: List of invitations
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InvitationListResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/invitations:
 *   post:
 *     summary: Create and send an invitation
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InvitationCreateRequest'
 *     responses:
 *       201:
 *         description: Invitation created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InvitationCreateResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Conflict (for example, user with email already exists)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/invitations/{id}/resend:
 *   post:
 *     summary: Resend a pending invitation (regenerates token and expiry)
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 22
 *     responses:
 *       200:
 *         description: Invitation resent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InvitationCreateResponse'
 *       400:
 *         description: Invalid invitation state
 *       404:
 *         description: Invitation not found
 */

/**
 * @openapi
 * /api/invitations/{id}/revoke:
 *   post:
 *     summary: Revoke a pending invitation
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 22
 *     responses:
 *       200:
 *         description: Invitation revoked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Invitation'
 *       400:
 *         description: Invalid invitation state
 *       404:
 *         description: Invitation not found
 */

/**
 * @openapi
 * /api/invitations/verify:
 *   get:
 *     summary: Verify invitation token and return prefill-safe data
 *     tags: [Invitations]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         example: f2c8d1e1f2c8d1e1f2c8d1e1f2c8d1e1
 *     responses:
 *       200:
 *         description: Invitation token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Invitation'
 *       400:
 *         description: Missing token, expired token, revoked invitation, or already accepted invitation
 *       404:
 *         description: Invitation not found
 */

/**
 * @openapi
 * /api/invitations/accept:
 *   post:
 *     summary: Complete invite-based registration
 *     tags: [Invitations]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InvitationAcceptRequest'
 *     responses:
 *       201:
 *         description: Registration completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InvitationAcceptResponse'
 *       400:
 *         description: Validation error, invalid invitation state, or missing phone when required
 *       404:
 *         description: Invitation not found
 */

// Public — invitee-facing endpoints (no auth: they aren't a user yet)
router.get('/verify', verifyInvitation);
router.post('/accept', acceptInvitation);

// Admin/manager — invite management
router.post('/', authenticate, authorize([1, 2]), createInvitation);
router.get('/', authenticate, authorize([1, 2]), listInvitations);
router.post('/:id/resend', authenticate, authorize([1, 2]), validateIdParam(), resendInvitation);
router.post('/:id/revoke', authenticate, authorize([1, 2]), validateIdParam(), revokeInvitation);

module.exports = router;
