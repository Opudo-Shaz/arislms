const express = require('express');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const ledgerController = require('../controllers/ledgerController');

const router = express.Router();

/**
 * @openapi
 * /api/ledger/entries:
 *   get:
 *     summary: Get all journal entries (paginated)
 *     tags:
 *       - Ledger
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sourceType
 *         schema:
 *           type: string
 *           enum: [LOAN_DISBURSEMENT, PAYMENT, CONTRIBUTION, MANUAL, FEE, EXPENSE, REVERSAL]
 *         example: PAYMENT
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *         example: "2026-01-01"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *         example: "2026-04-30"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         example: 20
 *     responses:
 *       200:
 *         description: Paginated list of journal entries
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               total: 42
 *               page: 1
 *               limit: 20
 *               entries:
 *                 - id: 1
 *                   reference: "JE-00001"
 *                   entryDate: "2026-03-01"
 *                   description: "Loan #3 disbursement to client #2"
 *                   status: "POSTED"
 *                   sourceType: "LOAN_DISBURSEMENT"
 *                   sourceId: 3
 *                   lines:
 *                     - accountCode: "1100"
 *                       accountName: "Loans Receivable – Principal"
 *                       debit: 50000
 *                       credit: 0
 *                     - accountCode: "1001"
 *                       accountName: "Cash / Bank Account"
 *                       debit: 0
 *                       credit: 50000
 */
router.get('/entries', authenticate, ledgerController.getAllEntries);

/**
 * @openapi
 * /api/ledger/entries:
 *   post:
 *     summary: Post a manual journal entry (admin only)
 *     tags:
 *       - Ledger
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             entryDate: "2026-04-22"
 *             description: "Office software subscription – April 2026"
 *             sourceType: "EXPENSE"
 *             lines:
 *               - accountCode: "5001"
 *                 debit: 2500
 *                 description: "Monthly software fee"
 *               - accountCode: "2001"
 *                 credit: 2500
 *                 description: "Payable to vendor"
 *     responses:
 *       201:
 *         description: Journal entry posted successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: 15
 *                 reference: "JE-00015"
 *                 status: "POSTED"
 *                 lines:
 *                   - accountCode: "5001"
 *                     debit: 2500
 *                     credit: 0
 *                   - accountCode: "2001"
 *                     debit: 0
 *                     credit: 2500
 *       400:
 *         description: Entry not balanced or account not found
 */
router.post('/entries', authenticate, authorize([1, 2]), ledgerController.createManualEntry);

/**
 * @openapi
 * /api/ledger/entries/{id}/reverse:
 *   post:
 *     summary: Reverse a posted journal entry (admin only)
 *     tags:
 *       - Ledger
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 15
 *     requestBody:
 *       content:
 *         application/json:
 *           example:
 *             description: "Reversing duplicate entry"
 *     responses:
 *       200:
 *         description: Entry reversed successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 original:
 *                   id: 15
 *                   reference: "JE-00015"
 *                   status: "REVERSED"
 *                 reversal:
 *                   id: 16
 *                   reference: "JE-00016"
 *                   status: "POSTED"
 *       400:
 *         description: Entry not found or not in POSTED status
 */
router.post('/entries/:id/reverse', authenticate, authorize([1, 2]), ledgerController.reverseEntry);

/**
 * @openapi
 * /api/ledger/trial-balance:
 *   get:
 *     summary: Get trial balance (all account balances)
 *     description: Verification tool. grandDebit should equal grandCredit when books are balanced.
 *     tags:
 *       - Ledger
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: asOf
 *         schema:
 *           type: string
 *         description: Include only entries on or before this date (YYYY-MM-DD)
 *         example: "2026-04-30"
 *     responses:
 *       200:
 *         description: Trial balance
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 grandDebit: 150000
 *                 grandCredit: 150000
 *                 balanced: true
 *                 accounts:
 *                   - code: "1001"
 *                     name: "Cash / Bank Account"
 *                     type: "ASSET"
 *                     normalBalance: "DEBIT"
 *                     totalDebit: 100000
 *                     totalCredit: 50000
 *                     balance: 50000
 *                   - code: "1100"
 *                     name: "Loans Receivable – Principal"
 *                     type: "ASSET"
 *                     normalBalance: "DEBIT"
 *                     totalDebit: 50000
 *                     totalCredit: 10000
 *                     balance: 40000
 */
router.get('/trial-balance', authenticate, ledgerController.getTrialBalance);

/**
 * @openapi
 * /api/ledger/accounts/{code}/statement:
 *   get:
 *     summary: Get statement for a single account
 *     description: Returns all posted lines for the account with a running balance. Use account code e.g. 1001, 1100, 4001.
 *     tags:
 *       - Ledger
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         example: "1100"
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *         example: "2026-01-01"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *         example: "2026-04-30"
 *     responses:
 *       200:
 *         description: Account statement with running balance
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 account:
 *                   code: "1100"
 *                   name: "Loans Receivable – Principal"
 *                 rows:
 *                   - date: "2026-03-01"
 *                     reference: "JE-00001"
 *                     description: "Loan #3 disbursement"
 *                     debit: 50000
 *                     credit: 0
 *                     balance: 50000
 *                     loanId: 3
 *                     clientId: 2
 *                   - date: "2026-04-01"
 *                     reference: "JE-00004"
 *                     description: "Principal repaid – Payment #1"
 *                     debit: 0
 *                     credit: 4167
 *                     balance: 45833
 *                     loanId: 3
 *                     clientId: 2
 *       404:
 *         description: Account not found
 */
router.get('/accounts/:code/statement', authenticate, ledgerController.getAccountStatement);

/**
 * @openapi
 * /api/ledger/income-summary:
 *   get:
 *     summary: Get income and expense summary for a period
 *     tags:
 *       - Ledger
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *         example: "2026-01-01"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *         example: "2026-04-30"
 *     responses:
 *       200:
 *         description: Income and expense summary
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 totalRevenue: 18500
 *                 totalExpenses: 2500
 *                 netIncome: 16000
 *                 accounts:
 *                   - code: "4001"
 *                     name: "Interest Income"
 *                     type: "REVENUE"
 *                     balance: 15000
 *                   - code: "4002"
 *                     name: "Loan Service Fees Income"
 *                     type: "REVENUE"
 *                     balance: 3500
 *                   - code: "5001"
 *                     name: "Office / Software Expenses"
 *                     type: "EXPENSE"
 *                     balance: 2500
 */
router.get('/income-summary', authenticate, ledgerController.getIncomeSummary);

/**
 * @openapi
 * /api/ledger/available-funds:
 *   get:
 *     summary: Get cash available for lending or operations
 *     description: Returns the balance of account 1001 (Cash / Bank). This is the exact amount the group has available to disburse or spend.
 *     tags:
 *       - Ledger
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available cash balance
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 account:
 *                   code: "1001"
 *                   name: "Cash / Bank Account"
 *                 totalDebit: 200000
 *                 totalCredit: 150000
 *                 balance: 50000
 */
router.get('/available-funds', authenticate, ledgerController.getAvailableFunds);

module.exports = router;
