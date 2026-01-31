const express = require('express');
const controller = require('../controllers/loanProductController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @openapi
 * /api/loan-products:
 *   post:
 *     summary: Create a loan product (admin only)
 *     tags:
 *       - Loan Products
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             name: Personal Loan
 *             interestRate: 5.5
 *             maxAmount: 50000
 *             termMonths: 36
 *     responses:
 *       201:
 *         description: Loan product created successfully
 *         content:
 *           application/json:
 *             example:
 *               id: 3
 *               name: Personal Loan
 *               interestRate: 5.5
 *               maxAmount: 50000
 *               termMonths: 36
 */
router.post('/', authenticate, authorize([1,2]), controller.create);

/**
 * @openapi
 * /api/loan-products:
 *   get:
 *     summary: Get all loan products (admin only)
 *     tags:
 *       - Loan Products
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of loan products
 *         content:
 *           application/json:
 *             example:
 *               - id: 1
 *                 name: Home Loan
 *                 interestRate: 4.2
 *                 maxAmount: 250000
 *                 termMonths: 240
 *               - id: 2
 *                 name: Car Loan
 *                 interestRate: 6.1
 *                 maxAmount: 80000
 *                 termMonths: 60
 */
router.get('/', authenticate, authorize([1,2]), controller.getAll);

/**
 * @openapi
 * /api/loan-products/{id}:
 *   get:
 *     summary: Get loan product by ID (admin only)
 *     tags:
 *       - Loan Products
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
 *         description: Loan product details
 *         content:
 *           application/json:
 *             example:
 *               id: 2
 *               name: Car Loan
 *               interestRate: 6.1
 *               maxAmount: 80000
 *               termMonths: 60
 */
router.get('/:id', authenticate, authorize([1,2]), controller.getOne);

/**
 * @openapi
 * /api/loan-products/{id}:
 *   put:
 *     summary: Update loan product (admin only)
 *     tags:
 *       - Loan Products
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 2
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             interestRate: 5.9
 *             maxAmount: 90000
 *     responses:
 *       200:
 *         description: Loan product updated successfully
 */
router.put('/:id', authenticate, authorize([1,2]), controller.update);

/**
 * @openapi
 * /api/loan-products/{id}:
 *   delete:
 *     summary: Delete loan product (admin only)
 *     tags:
 *       - Loan Products
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 3
 *     responses:
 *       200:
 *         description: Loan product deleted successfully
 */
router.delete('/:id', authenticate, authorize([1,2]), controller.delete);

module.exports = router;
