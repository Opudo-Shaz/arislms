const express = require('express');
const {
  getAllLoans,
  getLoanById,
  createLoan,
  updateLoan,
  deleteLoan,
  getMyLoans,
  approveLoan,
  disburseLoan
} = require('../controllers/loanController');

const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @openapi
 * /api/loans:
 *   get:
 *     summary: Get all loans (admin only)
 *     tags:
 *       - Loans
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all loans
 *         content:
 *           application/json:
 *             example:
 *               - id: 1
 *                 clientId: 5
 *                 amount: 10000
 *                 status: active
 *                 interestRate: 10
 *               - id: 2
 *                 clientId: 8
 *                 amount: 5000
 *                 status: closed
 */
router.get('/', authenticate, authorize([1,2]), getAllLoans);

/**
 * @openapi
 * /api/loans/my:
 *   get:
 *     summary: Get my loans (authenticated user)
 *     tags:
 *       - Loans
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Loans belonging to logged-in user
 *         content:
 *           application/json:
 *             example:
 *               - id: 10
 *                 amount: 7000
 *                 status: active
 *                 balance: 4200
 */
router.get('/my', authenticate, getMyLoans);

/**
 * @openapi
 * /api/loans/{id}:
 *   get:
 *     summary: Get loan by ID (user can only access own loan unless admin)
 *     tags:
 *       - Loans
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 10
 *     responses:
 *       200:
 *         description: Loan details
 *         content:
 *           application/json:
 *             example:
 *               id: 10
 *               amount: 7000
 *               interestRate: 8
 *               status: active
 *               balance: 4200
 */
router.get('/:id', authenticate, getLoanById);

/**
 * @openapi
 * /api/loans:
 *   post:
 *     summary: Create a new loan
 *     tags:
 *       - Loans
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             clientId: 5
 *             amount: 15000
 *             interestRate: 12
 *             durationMonths: 24
 *     responses:
 *       201:
 *         description: Loan created successfully
 *         content:
 *           application/json:
 *             example:
 *               id: 25
 *               clientId: 5
 *               amount: 15000
 *               status: pending
 */
router.post('/', authenticate, createLoan);

/**
 * @openapi
 * /api/loans/{id}:
 *   put:
 *     summary: Update loan (admin only)
 *     tags:
 *       - Loans
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 25
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             status: approved
 *             interestRate: 10
 *     responses:
 *       200:
 *         description: Loan updated successfully
 */
router.put('/:id', authenticate, authorize([1,2]), updateLoan);

/**
 * @openapi
 * /api/loans/{id}:
 *   delete:
 *     summary: Delete loan (admin only)
 *     tags:
 *       - Loans
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 25
 *     responses:
 *       200:
 *         description: Loan deleted successfully
 */
router.delete('/:id', authenticate, authorize([1,2]), deleteLoan);

/**
 * @openapi
 * /api/loans/{id}/disburse:
 *   post:
 *     summary: Disburse an approved loan and generate repayment schedule (admin only)
 *     tags:
 *       - Loans
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 25
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - disbursementDate
 *             properties:
 *               disbursementDate:
 *                 type: string
 *                 format: date
 *                 description: Date when loan is disbursed (YYYY-MM-DD)
 *                 example: "2026-03-01"
 *     responses:
 *       200:
 *         description: Loan disbursed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     loan:
 *                       type: object
 *                     installmentsCount:
 *                       type: integer
 *                     disbursementDate:
 *                       type: string
 *                       format: date
 *                     nextPaymentDate:
 *                       type: string
 *                       format: date
 *       400:
 *         description: Invalid request or loan cannot be disbursed
 *       404:
 *         description: Loan not found
 */
router.post('/:id/disburse', authenticate, authorize([1,2]), disburseLoan);

/**
 * @openapi
 * /api/loans/{id}/approve:
 *   post:
 *     summary: Approve a pending loan (admin only)
 *     tags:
 *       - Loans
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 25
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - approvalDate
 *             properties:
 *               approvalDate:
 *                 type: string
 *                 format: date
 *                 description: Date when loan is approved (YYYY-MM-DD)
 *                 example: "2026-02-22"
 *     responses:
 *       200:
 *         description: Loan approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid request or loan cannot be approved
 *       404:
 *         description: Loan not found
 */
router.post('/:id/approve', authenticate, authorize([1,2]), approveLoan);


module.exports = router;
