const express = require('express');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const chartOfAccountController = require('../controllers/chartOfAccountController');

const router = express.Router();

/**
 * @openapi
 * /api/chart-of-accounts:
 *   get:
 *     summary: Get all active chart of accounts
 *     tags:
 *       - Chart of Accounts
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active accounts
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id: 1
 *                   code: "1001"
 *                   name: "Cash / Bank Account"
 *                   type: "ASSET"
 *                   normalBalance: "DEBIT"
 *                   isActive: true
 *                 - id: 2
 *                   code: "1100"
 *                   name: "Loans Receivable – Principal"
 *                   type: "ASSET"
 *                   normalBalance: "DEBIT"
 *                   isActive: true
 */
router.get('/', authenticate, chartOfAccountController.getAll);

/**
 * @openapi
 * /api/chart-of-accounts/{id}:
 *   get:
 *     summary: Get a single account by ID
 *     tags:
 *       - Chart of Accounts
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
 *         description: Account details
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: 1
 *                 code: "1001"
 *                 name: "Cash / Bank Account"
 *                 type: "ASSET"
 *                 normalBalance: "DEBIT"
 *                 isActive: true
 *       404:
 *         description: Account not found
 */
router.get('/:id', authenticate, chartOfAccountController.getById);

/**
 * @openapi
 * /api/chart-of-accounts:
 *   post:
 *     summary: Create a new chart of account (admin only)
 *     tags:
 *       - Chart of Accounts
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             code: "5002"
 *             name: "Bank Charges"
 *             type: "EXPENSE"
 *             normalBalance: "DEBIT"
 *             description: "Fees charged by the bank"
 *     responses:
 *       201:
 *         description: Account created successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: 12
 *                 code: "5002"
 *                 name: "Bank Charges"
 *                 type: "EXPENSE"
 *                 normalBalance: "DEBIT"
 *                 isActive: true
 *       400:
 *         description: Validation error
 *       409:
 *         description: Account code already exists
 */
router.post('/', authenticate, authorize([1, 2]), chartOfAccountController.create);

/**
 * @openapi
 * /api/chart-of-accounts/{id}:
 *   put:
 *     summary: Update an account (admin only)
 *     tags:
 *       - Chart of Accounts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 12
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             name: "Bank Charges & Fees"
 *             description: "All bank-related charges"
 *     responses:
 *       200:
 *         description: Account updated successfully
 *       404:
 *         description: Account not found
 */
router.put('/:id', authenticate, authorize([1, 2]), chartOfAccountController.update);

/**
 * @openapi
 * /api/chart-of-accounts/{id}:
 *   delete:
 *     summary: Deactivate an account (admin only)
 *     tags:
 *       - Chart of Accounts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 12
 *     responses:
 *       200:
 *         description: Account deactivated
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Account deactivated"
 *       404:
 *         description: Account not found
 */
router.delete('/:id', authenticate, authorize([1, 2]), chartOfAccountController.deactivate);

module.exports = router;
