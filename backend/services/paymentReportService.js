const { Op } = require('sequelize');
const PaymentReport = require('../models/paymentReportModel');
const Payment = require('../models/paymentModel');
const Loan = require('../models/loanModel');
const Client = require('../models/clientModel');
const PaymentReportStatus = require('../enums/paymentReportStatus');
const LoanStatus = require('../enums/loanStatus');
const NotificationEventType = require('../enums/notificationEventType');
const NotificationChannel = require('../enums/notificationChannel');
const { PERMISSIONS } = require('../constants/permissions');
const { getActiveUsersWithPermission } = require('../utils/permissionUtils');
const { buildRecipients, safeNotify } = require('./notification/notificationTriggers');
const { paginateKeyset } = require('../utils/keysetPagination');
const paymentService = require('./paymentService');
const portalService = require('./portalService');
const AuditLogger = require('../utils/auditLogger');
const logger = require('../config/logger');

/**
 * Client-reported manual repayments (temporary, until M-Pesa integration).
 *
 * Flow: client reports a payment in the portal → reviewers (payment_reports:review)
 * are notified → a reviewer optionally amends the details → applies it, which
 * records a real Payment through paymentService.createPayment (schedule
 * allocation, ledger posting, PAYMENT_RECEIVED notification) — or rejects it.
 */

// Fields a reviewer may correct before applying (e.g. a mistyped M-Pesa code).
const AMENDABLE_FIELDS = ['amount', 'transactionDate', 'paymentMethod', 'externalRef', 'payerPhone', 'notes', 'loanId'];

const httpError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const reportInclude = [
  { model: Client, as: 'client', attributes: ['id', 'firstName', 'lastName', 'accountNumber', 'phone'] },
  { model: Loan, as: 'loan', attributes: ['id', 'referenceCode', 'status', 'currency', 'outstandingBalance', 'clientId'] },
  { association: 'reviewer', attributes: ['id', 'first_name', 'last_name', 'email'], required: false },
];

/** Loan a client can report a payment against: repayable, or approved awaiting a down payment. */
async function resolveReportableLoan(clientId) {
  const repayable = await portalService.getCurrentLoan(clientId, portalService.REPAYABLE_STATUSES);
  if (repayable) return repayable;

  const awaitingDownPayment = await Loan.findOne({
    where: { clientId, status: LoanStatus.APPROVED, downPaymentRequired: { [Op.gt]: 0 } },
    order: [['created_at', 'DESC']],
  });
  return awaitingDownPayment || null;
}

/** Reject a reference already used by a recorded payment or another open report for this client. */
async function assertRefUnused(clientId, externalRef, { excludeReportId = null } = {}) {
  const payment = await Payment.findOne({
    where: { externalRef },
    include: [{ model: Loan, where: { clientId }, required: true, attributes: ['id'] }],
    attributes: ['id'],
  });
  if (payment) throw httpError(`Reference ${externalRef} has already been recorded as a payment.`, 409);

  const report = await PaymentReport.findOne({
    where: {
      clientId,
      externalRef,
      status: [PaymentReportStatus.PENDING, PaymentReportStatus.PROCESSING],
      ...(excludeReportId ? { id: { [Op.ne]: excludeReportId } } : {}),
    },
    attributes: ['id'],
  });
  if (report) throw httpError(`Reference ${externalRef} has already been reported and is awaiting confirmation.`, 409);
}

const clientName = (client) => [client?.firstName, client?.lastName].filter(Boolean).join(' ');

const paymentReportService = {
  // ── Client (portal) side ────────────────────────────────────────────

  async submitReport(clientId, dto, userAgent = 'unknown') {
    const loan = await resolveReportableLoan(clientId);
    if (!loan) {
      throw httpError('You have no active loan to report a repayment against.', 422);
    }

    const externalRef = dto.externalRef.trim().toUpperCase();
    await assertRefUnused(clientId, externalRef);

    const values = {
      amount: dto.amount,
      currency: loan.currency,
      transactionDate: dto.transactionDate,
      paymentMethod: dto.paymentMethod || 'MPESA',
      externalRef,
      payerPhone: dto.payerPhone || null,
      notes: dto.notes || null,
    };

    const report = await PaymentReport.create({
      ...values,
      clientId,
      loanId: loan.id,
      status: PaymentReportStatus.PENDING,
      originalSubmission: { ...values, loanId: loan.id },
    });

    await AuditLogger.log({
      entityType: 'PAYMENT_REPORT',
      entityId: report.id,
      action: 'CREATE',
      data: { ...values, loanId: loan.id },
      actorId: clientId,
      options: { actorType: 'CLIENT', source: userAgent },
    });

    const client = await Client.findByPk(clientId, { attributes: ['id', 'firstName', 'lastName'] });
    const reviewers = await getActiveUsersWithPermission(PERMISSIONS.PAYMENT_REPORTS.REVIEW);
    if (reviewers.length) {
      await safeNotify(NotificationEventType.PAYMENT_REPORT_SUBMITTED, {
        recipients: reviewers,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        context: {
          clientName: clientName(client),
          amount: Number(values.amount).toLocaleString(),
          currency: values.currency,
          externalRef,
          paymentMethod: values.paymentMethod,
          referenceCode: loan.referenceCode,
        },
        relatedLoanId: loan.id,
        dedupeKey: `payment-report:${report.id}`,
      });
    } else {
      logger.warn(`[paymentReport] no active users hold ${PERMISSIONS.PAYMENT_REPORTS.REVIEW}; report ${report.id} queued without alerts`);
    }

    logger.info(`[paymentReport] client ${clientId} reported ${values.currency} ${values.amount} ref ${externalRef} (report ${report.id})`);
    return report.reload({ include: reportInclude });
  },

  async listClientReports(clientId, { cursor, direction, limit = 20 } = {}) {
    return paginateKeyset(PaymentReport, {
      keys: [['created_at', 'timestamp'], ['id', 'int']],
      cursor,
      direction,
      limit,
      where: { clientId },
      include: [{ model: Loan, as: 'loan', attributes: ['id', 'referenceCode'] }],
    });
  },

  // ── Staff side ──────────────────────────────────────────────────────

  async listReports({ cursor, direction, limit = 20, status } = {}) {
    return paginateKeyset(PaymentReport, {
      keys: [['created_at', 'timestamp'], ['id', 'int']],
      cursor,
      direction,
      limit,
      where: status ? { status } : {},
      include: reportInclude,
    });
  },

  async getReport(id) {
    const report = await PaymentReport.findByPk(id, { include: reportInclude });
    if (!report) throw httpError('Payment report not found', 404);
    return report;
  },

  /** Correct a pending report's details before applying it. */
  async amendReport(id, changes, reviewer, userAgent = 'unknown') {
    const report = await PaymentReport.findByPk(id);
    if (!report) throw httpError('Payment report not found', 404);
    if (report.status !== PaymentReportStatus.PENDING) {
      throw httpError(`Only pending reports can be amended (current status: ${report.status}).`, 409);
    }

    const updates = {};
    for (const field of AMENDABLE_FIELDS) {
      if (changes[field] !== undefined) updates[field] = changes[field];
    }
    if (updates.externalRef) {
      updates.externalRef = updates.externalRef.trim().toUpperCase();
      if (updates.externalRef !== report.externalRef) {
        await assertRefUnused(report.clientId, updates.externalRef, { excludeReportId: report.id });
      }
    }
    if (updates.loanId && Number(updates.loanId) !== Number(report.loanId)) {
      const loan = await Loan.findOne({ where: { id: updates.loanId, clientId: report.clientId } });
      if (!loan) throw httpError('That loan does not belong to this client.', 422);
      updates.currency = loan.currency;
    }

    const before = report.toJSON();
    await report.update(updates);

    await AuditLogger.log({
      entityType: 'PAYMENT_REPORT',
      entityId: report.id,
      action: 'UPDATE',
      data: {
        changes: updates,
        previous: Object.fromEntries(Object.keys(updates).map((k) => [k, before[k]])),
      },
      actorId: reviewer.id,
      options: { actorType: 'USER', source: userAgent },
    });

    return this.getReport(id);
  },

  /**
   * Apply a pending report: record it as a real loan repayment.
   *
   * The report is first claimed with a conditional UPDATE (pending →
   * processing), so concurrent applies can't both succeed. createPayment runs
   * its own transaction; if it fails the claim is released back to pending and
   * the error is surfaced so the reviewer can amend and retry.
   */
  async applyReport(id, reviewer, userAgent = 'unknown', { reviewNotes } = {}) {
    const [claimed] = await PaymentReport.update(
      { status: PaymentReportStatus.PROCESSING },
      { where: { id, status: PaymentReportStatus.PENDING } }
    );
    if (!claimed) {
      const existing = await PaymentReport.findByPk(id, { attributes: ['id', 'status'] });
      if (!existing) throw httpError('Payment report not found', 404);
      throw httpError(`This report is already ${existing.status}.`, 409);
    }

    const report = await PaymentReport.findByPk(id);
    let result;
    try {
      result = await paymentService.createPayment(
        {
          clientId: report.clientId,
          loanId: report.loanId,
          amount: report.amount,
          currency: report.currency,
          paymentMethod: report.paymentMethod,
          externalRef: report.externalRef,
          payerPhone: report.payerPhone,
          transactionDate: report.transactionDate,
          notes: [`Client-reported payment #${report.id}`, report.notes].filter(Boolean).join(' — '),
        },
        reviewer,
        userAgent
      );
    } catch (error) {
      await PaymentReport.update(
        { status: PaymentReportStatus.PENDING },
        { where: { id, status: PaymentReportStatus.PROCESSING } }
      );
      logger.warn(`[paymentReport] apply of report ${id} failed: ${error.message}`);
      throw httpError(error.message, 422);
    }

    await report.update({
      status: PaymentReportStatus.APPLIED,
      paymentId: result.payment.id,
      reviewedBy: reviewer.id,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes || null,
    });

    await AuditLogger.log({
      entityType: 'PAYMENT_REPORT',
      entityId: report.id,
      action: 'APPROVE',
      data: { paymentId: result.payment.id, reviewNotes: reviewNotes || null },
      actorId: reviewer.id,
      options: { actorType: 'USER', source: userAgent },
    });

    logger.info(`[paymentReport] report ${id} applied as payment ${result.payment.id} by user ${reviewer.id}`);
    return this.getReport(id);
  },

  async rejectReport(id, reviewer, reason, userAgent = 'unknown') {
    const [rejected] = await PaymentReport.update(
      {
        status: PaymentReportStatus.REJECTED,
        reviewedBy: reviewer.id,
        reviewedAt: new Date(),
        reviewNotes: reason,
      },
      { where: { id, status: PaymentReportStatus.PENDING } }
    );
    if (!rejected) {
      const existing = await PaymentReport.findByPk(id, { attributes: ['id', 'status'] });
      if (!existing) throw httpError('Payment report not found', 404);
      throw httpError(`This report is already ${existing.status}.`, 409);
    }

    const report = await this.getReport(id);

    await AuditLogger.log({
      entityType: 'PAYMENT_REPORT',
      entityId: report.id,
      action: 'REJECT',
      data: { reason },
      actorId: reviewer.id,
      options: { actorType: 'USER', source: userAgent },
    });

    const client = await Client.findByPk(report.clientId);
    await safeNotify(NotificationEventType.PAYMENT_REPORT_REJECTED, {
      recipients: buildRecipients({ client }),
      context: {
        clientName: clientName(client),
        amount: Number(report.amount).toLocaleString(),
        currency: report.currency,
        externalRef: report.externalRef,
        reasonNote: reason ? ` Reason: ${reason}.` : '',
      },
      relatedLoanId: report.loanId,
      dedupeKey: `payment-report-rejected:${report.id}`,
    });

    return report;
  },
};

module.exports = paymentReportService;
