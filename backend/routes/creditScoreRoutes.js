const express = require('express');
const {
  getCreditScoreByClientId
} = require('../controllers/creditScoreController');

const { authenticate, requirePermission } = require('../middleware/authMiddleware');
const { validateIdParam } = require('../middleware/validateIdParam');

const router = express.Router();



/**
 * @openapi
 * /api/credit-scores/client/{clientId}:
 *   get:
 *     summary: Get the most recent credit score for a specific client
 *     tags:
 *       - Credit Scores
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *     responses:
 *       200:
 *         description: Most recent credit score for the client
 *         content:
 *           application/json:
 *             example:
 *               - id: 1
 *                 clientId: 5
 *                 riskScore: 45
 *                 riskGrade: D
 */
router.get('/client/:clientId', authenticate, requirePermission('credit_scores:read'), validateIdParam('clientId'), getCreditScoreByClientId);











module.exports = router;
