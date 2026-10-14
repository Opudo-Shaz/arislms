const express = require('express');
const { authenticate, requirePermission } = require('../middleware/authMiddleware');
const { validateIdParam } = require('../middleware/validateIdParam');
const { PERMISSIONS } = require('../constants/permissions');
const paymentReportController = require('../controllers/paymentReportController');

const router = express.Router();

/**
 * @openapi
 * /api/payment-reports:
 *   get:
 *     summary: Client-reported payments awaiting confirmation (keyset paginated)
 *     tags:
 *       - Payment Reports
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, processing, applied, rejected] }
 *     responses:
 *       200:
 *         description: Page of payment reports
 */
router.get('/', authenticate, requirePermission(PERMISSIONS.PAYMENT_REPORTS.READ), paymentReportController.listReports);

/**
 * @openapi
 * /api/payment-reports/{id}:
 *   get:
 *     summary: Get a payment report (includes the client's original submission)
 *     tags:
 *       - Payment Reports
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Payment report
 *   patch:
 *     summary: Amend a pending report before applying (e.g. fix a mistyped reference)
 *     tags:
 *       - Payment Reports
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             externalRef: SJK3XY12AC
 *             amount: 2500
 *     responses:
 *       200:
 *         description: Updated report
 *       409:
 *         description: Report is no longer pending, or reference already used
 */
router.get('/:id', authenticate, requirePermission(PERMISSIONS.PAYMENT_REPORTS.READ), validateIdParam(), paymentReportController.getReport);
router.patch('/:id', authenticate, requirePermission(PERMISSIONS.PAYMENT_REPORTS.REVIEW), validateIdParam(), paymentReportController.amendReport);

/**
 * @openapi
 * /api/payment-reports/{id}/apply:
 *   post:
 *     summary: Confirm a report and record it as a loan repayment
 *     tags:
 *       - Payment Reports
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           example:
 *             reviewNotes: Matched on M-Pesa statement
 *     responses:
 *       200:
 *         description: Applied; `paymentId` links the recorded payment
 *       409:
 *         description: Already applied/rejected
 *       422:
 *         description: Payment could not be recorded (e.g. loan not payable)
 */
router.post('/:id/apply', authenticate, requirePermission(PERMISSIONS.PAYMENT_REPORTS.REVIEW), validateIdParam(), paymentReportController.applyReport);

/**
 * @openapi
 * /api/payment-reports/{id}/reject:
 *   post:
 *     summary: Reject a reported payment (client is notified with the reason)
 *     tags:
 *       - Payment Reports
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             reason: No matching transaction on the paybill statement
 *     responses:
 *       200:
 *         description: Rejected
 */
router.post('/:id/reject', authenticate, requirePermission(PERMISSIONS.PAYMENT_REPORTS.REVIEW), validateIdParam(), paymentReportController.rejectReport);

module.exports = router;
