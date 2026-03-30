const express = require('express');
const {
  getCreditScoresByClient
} = require('../controllers/creditScoreController');

const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();



/**
 * @openapi
 * /api/credit-scores/client/{clientId}:
 *   get:
 *     summary: Get all credit scores for a specific client
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
 *         description: List of credit scores for the client
 *         content:
 *           application/json:
 *             example:
 *               - id: 1
 *                 clientId: 5
 *                 riskScore: 45
 *                 riskGrade: D
 */
router.get('/client/:clientId', authenticate, authorize([1, 2]), getCreditScoresByClient);











module.exports = router;
