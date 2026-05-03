const express = require('express');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const memberContributionController = require('../controllers/memberContributionController');

const router = express.Router();

/**
 * @openapi
 * /api/member-contributions:
 *   get:
 *     summary: Get all member contributions and withdrawals
 *     tags:
 *       - Member Contributions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all contribution and withdrawal records
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id: 1
 *                   clientId: 3
 *                   amount: 10000
 *                   contributionDate: "2026-01-15"
 *                   type: "CONTRIBUTION"
 *                   journalEntryId: 2
 *                   client:
 *                     id: 3
 *                     firstName: "Jane"
 *                     lastName: "Mwangi"
 *                 - id: 2
 *                   clientId: 5
 *                   amount: 5000
 *                   contributionDate: "2026-01-15"
 *                   type: "CONTRIBUTION"
 *                   journalEntryId: 3
 */
router.get('/', authenticate, memberContributionController.getAll);

/**
 * @openapi
 * /api/member-contributions/member/{clientId}:
 *   get:
 *     summary: Get contribution history and net balance for a member
 *     tags:
 *       - Member Contributions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 3
 *     responses:
 *       200:
 *         description: Member contribution history with running totals
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 client:
 *                   id: 3
 *                   firstName: "Jane"
 *                   lastName: "Mwangi"
 *                 totalContributions: 30000
 *                 totalWithdrawals: 5000
 *                 netBalance: 25000
 *                 records:
 *                   - id: 1
 *                     amount: 10000
 *                     contributionDate: "2026-01-15"
 *                     type: "CONTRIBUTION"
 *                   - id: 4
 *                     amount: 5000
 *                     contributionDate: "2026-02-10"
 *                     type: "WITHDRAWAL"
 *       404:
 *         description: Client not found
 */
router.get('/member/:clientId', authenticate, memberContributionController.getByMember);

/**
 * @openapi
 * /api/member-contributions:
 *   post:
 *     summary: Record a member contribution or withdrawal (admin only)
 *     description: Use type CONTRIBUTION for capital deposits and WITHDRAWAL for capital redemptions. A balanced journal entry is auto-posted for each record.
 *     tags:
 *       - Member Contributions
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             clientId: 3
 *             amount: 10000
 *             contributionDate: "2026-04-22"
 *             type: "CONTRIBUTION"
 *             notes: "Initial capital deposit"
 *     responses:
 *       201:
 *         description: Contribution or withdrawal recorded and journal entry posted
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: 5
 *                 clientId: 3
 *                 amount: 10000
 *                 contributionDate: "2026-04-22"
 *                 type: "CONTRIBUTION"
 *                 journalEntryId: 18
 *       400:
 *         description: Validation error
 *       404:
 *         description: Client not found
 *       422:
 *         description: Withdrawal amount exceeds member balance
 */
router.post('/', authenticate, authorize([1, 2]), memberContributionController.create);

module.exports = router;
