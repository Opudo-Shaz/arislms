const express = require('express');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

/**
 * @openapi
 * /api/payments:
 *   get:
 *     summary: Get all payments (admin only)
 *     tags:
 *       - Payments
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of payments
 *         content:
 *           application/json:
 *             example:
 *               - id: 1
 *                 loanId: 10
 *                 amount: 500
 *                 paymentDate: 2026-01-15
 *               - id: 2
 *                 loanId: 11
 *                 amount: 300
 *                 paymentDate: 2026-01-20
 */
router.get('/', authenticate, authorize([1,2]), paymentController.getAll);

/**
 * @openapi
 * /api/payments/loan/{loanId}:
 *   get:
 *     summary: Get payments for a specific loan
 *     tags:
 *       - Payments
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
 *         description: Payments for loan
 *         content:
 *           application/json:
 *             example:
 *               - id: 5
 *                 amount: 250
 *                 paymentDate: 2026-01-10
 */
router.get('/loan/:loanId', authenticate, paymentController.getByLoan);

/**
 * @openapi
 * /api/payments:
 *   post:
 *     summary: Record a new payment
 *     tags:
 *       - Payments
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             loanId: 10
 *             amount: 500
 *             paymentDate: 2026-01-25
 *             method: cash
 *     responses:
 *       201:
 *         description: Payment recorded successfully
 *         content:
 *           application/json:
 *             example:
 *               id: 20
 *               loanId: 10
 *               amount: 500
 *               paymentDate: 2026-01-25
 *               method: cash
 */
router.post('/', authenticate, paymentController.create);

/**
 * @openapi
 * /api/payments/{id}:
 *   delete:
 *     summary: Delete payment (admin only)
 *     tags:
 *       - Payments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 20
 *     responses:
 *       200:
 *         description: Payment deleted successfully
 */
router.delete('/:id', authenticate, authorize([1,2]), paymentController.delete);

module.exports = router;
