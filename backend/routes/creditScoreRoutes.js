const express = require('express');
const {
  createCreditScore,
  getAllCreditScores,
  getCreditScore,
  getCreditScoresByClient,
  getCreditScoreByLoan,
  updateCreditScore,
  deleteCreditScore
} = require('../controllers/creditScoreController');

const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @openapi
 * /api/credit-scores:
 *   get:
 *     summary: Get all credit scores (admin only)
 *     tags:
 *       - Credit Scores
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all credit scores
 *         content:
 *           application/json:
 *             example:
 *               - id: 1
 *                 clientId: 5
 *                 riskScore: 45
 *                 riskGrade: D
 *                 riskDti: 0.35
 *               - id: 2
 *                 loanId: 10
 *                 riskScore: 75
 *                 riskGrade: B
 */
router.get('/', authenticate, authorize([1, 2]), getAllCreditScores);

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
router.get('/client/:clientId', authenticate, getCreditScoresByClient);

/**
 * @openapi
 * /api/credit-scores/loan/{loanId}:
 *   get:
 *     summary: Get credit score for a specific loan
 *     tags:
 *       - Credit Scores
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: loanId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 10
 *     responses:
 *       200:
 *         description: Credit score for the loan
 *         content:
 *           application/json:
 *             example:
 *               id: 2
 *               loanId: 10
 *               riskScore: 75
 *               riskGrade: B
 */
router.get('/loan/:loanId', authenticate, getCreditScoreByLoan);

/**
 * @openapi
 * /api/credit-scores/{id}:
 *   get:
 *     summary: Get credit score by ID
 *     tags:
 *       - Credit Scores
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
 *         description: Credit score details
 *         content:
 *           application/json:
 *             example:
 *               id: 1
 *               clientId: 5
 *               loanId: null
 *               riskScore: 45
 *               riskGrade: D
 *               riskDti: 0.35
 */
router.get('/:id', authenticate, getCreditScore);

/**
 * @openapi
 * /api/credit-scores:
 *   post:
 *     summary: Create a new credit score
 *     tags:
 *       - Credit Scores
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             clientId: 5
 *             riskScore: 45
 *             riskGrade: D
 *             riskDti: 0.35
 *             scoringModelVersion: "1.0"
 *             notes: "Initial credit evaluation"
 *     responses:
 *       201:
 *         description: Credit score created successfully
 *         content:
 *           application/json:
 *             example:
 *               id: 1
 *               clientId: 5
 *               riskScore: 45
 *               riskGrade: D
 *               riskDti: 0.35
 */
router.post('/', authenticate, authorize([1, 2]), createCreditScore);

/**
 * @openapi
 * /api/credit-scores/{id}:
 *   put:
 *     summary: Update credit score
 *     tags:
 *       - Credit Scores
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
 *             riskScore: 55
 *             riskGrade: C
 *             riskDti: 0.40
 *             notes: "Updated after reassessment"
 *     responses:
 *       200:
 *         description: Credit score updated successfully
 *         content:
 *           application/json:
 *             example:
 *               id: 1
 *               clientId: 5
 *               riskScore: 55
 *               riskGrade: C
 */
router.put('/:id', authenticate, authorize([1, 2]), updateCreditScore);

/**
 * @openapi
 * /api/credit-scores/{id}:
 *   delete:
 *     summary: Delete credit score
 *     tags:
 *       - Credit Scores
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
 *         description: Credit score deleted successfully
 */
router.delete('/:id', authenticate, authorize([1, 2]), deleteCreditScore);

module.exports = router;
