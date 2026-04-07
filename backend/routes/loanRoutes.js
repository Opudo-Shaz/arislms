const express = require('express');
const {
  getAllLoans,
  getLoanById,
  createLoan,
  createLoanWithoutCreditScoring,
  updateLoan,
  deleteLoan,
  getMyLoans,
  approveLoan,
  disburseLoan,
  getLoanMissedPayments,
  updateLoanMissedPaymentCount,
  getLoansWithMissedPayments,
  batchUpdateMissedPayments
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
 * /api/loans/missed-payments/all:
 *   get:
 *     summary: Get all loans with missed payments
 *     tags:
 *       - Loans
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all loans with missed payments
 */
router.get('/missed-payments/all', authenticate, authorize([1,2]), getLoansWithMissedPayments);

/**
 * @openapi
 * /api/loans/missed-payments/batch-update:
 *   post:
 *     summary: Batch update missed payments for all loans
 *     tags:
 *       - Loans
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Batch update completed
 */
router.post('/missed-payments/batch-update', authenticate, authorize([1,2]), batchUpdateMissedPayments);

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
 *     summary: Create a new loan with credit scoring
 *     description: |
 *       Creates a new loan application and automatically runs it through the credit scoring
 *       and risk policy engines before setting the initial status.
 *
 *       **Credit Scoring Flow:**
 *       - Client data and existing loan history are evaluated by the scoring engine.
 *       - A risk score, risk grade (A–E), and DTI (debt-to-income ratio) are calculated.
 *       - The risk policy engine then makes a decision: `APPROVED`, `MANUAL_REVIEW`, or `REJECTED`.
 *
 *       **Resulting Loan Status:**
 *       - `APPROVED` decision → loan is set to `under_review` (awaiting admin approval)
 *       - `MANUAL_REVIEW` or `REJECTED` decision → loan is set to `pending` (requires manual review)
 *
 *       Interest rates, term, fees, and currency are derived from the selected loan product.
 *       The client must have a verified KYC status to be eligible.
 *     tags:
 *       - Loans
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clientId
 *               - loanProductId
 *               - principalAmount
 *               - startDate
 *             properties:
 *               clientId:
 *                 type: integer
 *                 description: ID of the client applying for the loan
 *                 example: 1
 *               loanProductId:
 *                 type: integer
 *                 description: ID of the loan product to apply (determines interest rate, term, fees)
 *                 example: 1
 *               principalAmount:
 *                 type: number
 *                 description: Requested loan amount
 *                 example: 20000
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: Desired loan start date (YYYY-MM-DD)
 *                 example: "2026-04-04"
 *               termMonths:
 *                 type: integer
 *                 description: Loan term in months. Defaults to the loan product's repayment period if omitted.
 *                 example: 12
 *               collateral:
 *                 type: object
 *                 description: Collateral provided to secure the loan
 *                 properties:
 *                   type:
 *                     type: string
 *                     example: "Logbook"
 *                   details:
 *                     type: string
 *                     example: "Toyota Vitz 2018, KBZ 123A"
 *               coSignerId:
 *                 type: integer
 *                 nullable: true
 *                 description: User ID of the co-signer (optional)
 *                 example: null
 *               notes:
 *                 type: string
 *                 nullable: true
 *                 description: Any additional notes for the loan application
 *                 example: "First loan application for client."
 *           example:
 *             clientId: 1
 *             loanProductId: 1
 *             principalAmount: 20000
 *             startDate: "2026-04-04"
 *             termMonths: 12
 *             collateral:
 *               type: "Logbook"
 *               details: "Toyota Vitz 2018, KBZ 123A"
 *             coSignerId: null
 *             notes: "First loan application for client."
 *     responses:
 *       201:
 *         description: Loan created and scored successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Loan created successfully with credit scoring
 *               data:
 *                 id: 25
 *                 clientId: 1
 *                 loanProductId: 1
 *                 referenceCode: "LN-A1B2C3D4"
 *                 principalAmount: 20000
 *                 interestRate: 15.5
 *                 interestType: "reducing"
 *                 termMonths: 12
 *                 installmentAmount: "1823.45"
 *                 status: "under_review"
 *                 currency: "KES"
 *                 startDate: "2026-04-04"
 *                 endDate: "2027-04-04"
 *                 creditScore:
 *                   riskScore: 4
 *                   riskGrade: "B"
 *                   riskDti: 0.28
 *       400:
 *         description: Validation error — missing or invalid fields
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: Validation error
 *               errors:
 *                 - "clientId is required"
 *                 - "principalAmount must be greater than zero"
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — insufficient role permissions
 *       422:
 *         description: Loan rejected by risk policy
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Loan application rejected by risk policy. Risk Grade: E, Score: 1/5"
 *       500:
 *         description: Server error
 */
router.post('/', authenticate, authorize([1,2]), createLoan);

/**
 * @openapi
 * /api/loans/without-scoring:
 *   post:
 *     summary: Create a new loan without credit scoring (manual/override)
 *     tags:
 *       - Loans
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             clientId: 1
 *             loanProductId: 1
 *             principalAmount: 20000
 *             startDate: "2026-04-04"
 *             collateral: { type: "Logbook", details: "Toyota Vitz 2018" }
 *     responses:
 *       201:
 *         description: Loan created successfully without credit scoring
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Loan created successfully
 *               data:
 *                 id: 25
 *                 clientId: 1
 *                 status: pending
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post('/without-scoring', authenticate, authorize([1,2]), createLoanWithoutCreditScoring);

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

/**
 * @openapi
 * /api/loans/{id}/missed-payments:
 *   get:
 *     summary: Get missed payments for a loan
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
 *         example: 1
 *     responses:
 *       200:
 *         description: List of missed payments for the loan
 *         content:
 *           application/json:
 *             example:
 *               loanId: 1
 *               missedPaymentsCount: 2
 *               missedPayments:
 *                 - id: 5
 *                   installmentNumber: 2
 *                   dueDate: "2026-01-15"
 *                   totalAmount: 1000
 *                   status: overdue
 *                   isMissed: true
 */
router.get('/:id/missed-payments', authenticate, getLoanMissedPayments);

/**
 * @openapi
 * /api/loans/{id}/update-missed-payments:
 *   post:
 *     summary: Update missed payment count for a loan
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
 *         example: 1
 *     responses:
 *       200:
 *         description: Missed payment count updated successfully
 */
router.post('/:id/update-missed-payments', authenticate, authorize([1,2]), updateLoanMissedPaymentCount);


module.exports = router;
