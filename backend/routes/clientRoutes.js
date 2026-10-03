const express = require('express');
const clientController = require('../controllers/clientController');
const { authenticate, requirePermission } = require('../middleware/authMiddleware');
const { validateIdParam } = require('../middleware/validateIdParam');

const router = express.Router();

/**
 * @openapi
 * /api/clients:
 *   post:
 *     summary: Create a new client (admin only)
 *     tags:
 *       - Clients
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             name: Jane Doe
 *             email: jane@test.com
 *             phone: "+1234567890"
 *             address: "123 Main Street"
 *     responses:
 *       201:
 *         description: Client created successfully
 *         content:
 *           application/json:
 *             example:
 *               id: 5
 *               name: Jane Doe
 *               email: jane@test.com
 *               phone: "+1234567890"
 *               address: "123 Main Street"
 */
router.post('/', authenticate, requirePermission('clients:create'), clientController.createClient);

/**
 * @openapi
 * /api/clients:
 *   get:
 *     summary: List clients (keyset pagination, newest first)
 *     description: >
 *       Keyset (seek) pagination: pass the `nextCursor`/`prevCursor` from the
 *       previous response with `direction=next|prev`. No total count is returned.
 *       All list endpoints (loans, payments, contributions, ledger entries,
 *       notification outbox, audits) share this contract.
 *     tags:
 *       - Clients
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Full-text prefix search (every word must match) over name, account number, ID number, email and phone.
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *         description: Opaque cursor from a previous response. Omit for the first page.
 *       - in: query
 *         name: direction
 *         schema: { type: string, enum: [next, prev], default: next }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 500 }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: kycStatus
 *         schema: { type: string }
 *       - in: query
 *         name: queueOnly
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Page of clients
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id: 12
 *                   firstName: Jane
 *                   lastName: Doe
 *                   accountNumber: CL-3F2A9B1C
 *               pagination:
 *                 limit: 20
 *                 hasNext: true
 *                 hasPrev: false
 *                 nextCursor: eyJjIjoiMjAyNi0xMC0wMlQwODoxNTowMi4xMjM0NTZaIiwiaSI6MTJ9
 *                 prevCursor: null
 *       400:
 *         description: Invalid cursor or direction
 */
router.get('/', authenticate, clientController.getClients);

/**
 * @openapi
 * /api/clients/{id}:
 *   get:
 *     summary: Get client by ID (admin only)
 *     tags:
 *       - Clients
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Client details
 *         content:
 *           application/json:
 *             example:
 *               id: 1
 *               name: John Smith
 *               email: john@test.com
 *               phone: "+1234567890"
 *               address: "456 Elm Street"
 */
router.get('/:id', authenticate, validateIdParam(), clientController.getClient);

/**
 * @openapi
 * /api/clients/{id}:
 *   put:
 *     summary: Update client (admin only)
 *     tags:
 *       - Clients
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             name: Jane Doe Updated
 *             phone: "+1122334455"
 *     responses:
 *       200:
 *         description: Client updated successfully
 */
router.put('/:id', authenticate, requirePermission('clients:update'), validateIdParam(), clientController.updateClient);

/**
 * @openapi
 * /api/clients/{id}:
 *   delete:
 *     summary: Delete client (admin only)
 *     tags:
 *       - Clients
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 2
 *     responses:
 *       200:
 *         description: Client deleted successfully
 */
router.delete('/:id', authenticate, requirePermission('clients:delete'), validateIdParam(), clientController.deleteClient);

/**
 * @openapi
 * /api/clients/{id}/kyc/verify:
 *   post:
 *     summary: Verify KYC for a client (admin only)
 *     description: Marks the client's KYC as verified and sets their status to active.
 *     tags:
 *       - Clients - KYC
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           example:
 *             notes: KYC documents have been reviewed and verified.
 *     responses:
 *       200:
 *         description: KYC verified, client is now active
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: KYC verified successfully. Client is now active.
 *               data:
 *                 id: 1
 *                 status: active
 *                 kycStatus: verified
 *       404:
 *         description: Client not found
 */
router.post('/:id/kyc/verify', authenticate, requirePermission('clients:update'), clientController.verifyKyc);

/**
 * @openapi
 * /api/clients/{id}/kyc/request-info:
 *   post:
 *     summary: Request additional KYC information (admin only)
 *     description: Sets KYC status to in_progress and client status to pending_kyc_reverification. Stores reviewer notes.
 *     tags:
 *       - Clients - KYC
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             kycNotes: Please provide a clearer photo of your national ID back side.
 *     responses:
 *       200:
 *         description: KYC info requested, client pending re-verification
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: KYC info requested. Client status set to pending re-verification.
 *               data:
 *                 id: 1
 *                 status: pending_kyc_reverification
 *                 kycStatus: in_progress
 *                 kycNotes: Please provide a clearer photo of your national ID back side.
 *       400:
 *         description: kycNotes is required
 *       404:
 *         description: Client not found
 */
router.post('/:id/kyc/request-info', authenticate, requirePermission('clients:update'), clientController.requestKycInfo);

/**
 * @openapi
 * /api/clients/{id}/kyc/reject:
 *   post:
 *     summary: Reject KYC for a client (admin only)
 *     description: Sets KYC status to rejected and client status to kyc_failed. Client is deactivated.
 *     tags:
 *       - Clients - KYC
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           example:
 *             notes: KYC documents do not meet requirements. Rejection confirmed.
 *     responses:
 *       200:
 *         description: KYC rejected, client status set to kyc_failed
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: KYC rejected. Client status set to KYC failed.
 *               data:
 *                 id: 1
 *                 status: kyc_failed
 *                 kycStatus: rejected
 *                 isActive: false
 *       404:
 *         description: Client not found
 */
router.post('/:id/kyc/reject', authenticate, requirePermission('clients:update'), clientController.rejectKyc);

/**
 * @openapi
 * /api/clients/{id}/activate:
 *   post:
 *     summary: Activate a client (admin only)
 *     description: Overrides current status and sets client to active regardless of previous state.
 *     tags:
 *       - Clients - Status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           example:
 *             notes: Client passed manual review. Activating account.
 *     responses:
 *       200:
 *         description: Client activated
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Client activated successfully.
 *               data:
 *                 id: 1
 *                 status: active
 *                 isActive: true
 *       404:
 *         description: Client not found
 */
router.post('/:id/activate', authenticate, requirePermission('clients:update'), clientController.activateClient);

/**
 * @openapi
 * /api/clients/{id}/deactivate:
 *   post:
 *     summary: Deactivate a client (admin only)
 *     description: Sets client status to pending and isActive to false.
 *     tags:
 *       - Clients - Status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           example:
 *             notes: Client requested account deactivation.
 *     responses:
 *       200:
 *         description: Client deactivated
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Client deactivated successfully.
 *               data:
 *                 id: 1
 *                 status: pending
 *                 isActive: false
 *       404:
 *         description: Client not found
 */
router.post('/:id/deactivate', authenticate, requirePermission('clients:update'), clientController.deactivateClient);

/**
 * @openapi
 * /api/clients/{id}/suspend:
 *   post:
 *     summary: Suspend a client (admin only)
 *     description: Sets client status to suspended and isActive to false.
 *     tags:
 *       - Clients - Status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           example:
 *             notes: Client has a pending dispute under investigation.
 *     responses:
 *       200:
 *         description: Client suspended
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Client suspended successfully.
 *               data:
 *                 id: 1
 *                 status: suspended
 *                 isActive: false
 *       404:
 *         description: Client not found
 */
router.post('/:id/suspend', authenticate, requirePermission('clients:update'), clientController.suspendClient);

/**
 * @openapi
 * /api/clients/{id}/blacklist:
 *   post:
 *     summary: Blacklist a client (admin only)
 *     description: Sets client status to blacklisted and isActive to false.
 *     tags:
 *       - Clients - Status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           example:
 *             notes: Client flagged for fraudulent activity.
 *     responses:
 *       200:
 *         description: Client blacklisted
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Client blacklisted successfully.
 *               data:
 *                 id: 1
 *                 status: blacklisted
 *                 isActive: false
 *       404:
 *         description: Client not found
 */
router.post('/:id/blacklist', authenticate, requirePermission('clients:update'), clientController.blacklistClient);

/**
 * @openapi
 * /api/clients/{id}/credit-score/refresh:
 *   post:
 *     summary: Refresh credit score for a client (admin only)
 *     description: Re-runs the credit scoring engine for the client based on their current profile and loan history, and saves the result.
 *     tags:
 *       - Clients - Credit Score
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Credit score refreshed successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Credit score refreshed successfully.
 *               data:
 *                 id: 10
 *                 clientId: 1
 *                 riskScore: 3
 *                 riskGrade: B
 *                 riskDti: 0.35
 *       404:
 *         description: Client not found
 */
router.post('/:id/credit-score/refresh', authenticate, requirePermission('credit_scores:create'), clientController.refreshCreditScore);

module.exports = router;
