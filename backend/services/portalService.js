const Client = require('../models/clientModel');
const Loan = require('../models/loanModel');
const LoanProduct = require('../models/loanProductModel');
const Payment = require('../models/paymentModel');
const CreditScore = require('../models/creditScoreModel');
const RepaymentSchedule = require('../models/repaymentScheduleModel');
const LoanStatus = require('../enums/loanStatus');
const AuditLogger = require('../utils/auditLogger');
const { paginateKeyset } = require('../utils/keysetPagination');
const { invalidateAuthClient } = require('../utils/clientAuthCache');
const logger = require('../config/logger');

/**
 * Read/self-service operations for the client portal. Every method takes the
 * authenticated client's id (req.client.id) and scopes all queries to it —
 * nothing here accepts a client id from the request.
 */

// Loan statuses a client can still repay against (mirrors paymentService.createPayment).
const REPAYABLE_STATUSES = [
  LoanStatus.DISBURSED,
  LoanStatus.ACTIVE,
  LoanStatus.PARTIALLY_PAID,
  LoanStatus.OVERDUE,
];

// Statuses shown as the client's "current" loan on the dashboard, most relevant first.
const CURRENT_LOAN_STATUSES = [
  ...REPAYABLE_STATUSES,
  LoanStatus.DEFAULTED,
  LoanStatus.APPROVED,
  LoanStatus.UNDER_REVIEW,
  LoanStatus.IN_REVIEW,
  LoanStatus.PENDING,
];

// Profile fields a client may change themselves. Identity, income and KYC
// data stay staff-managed.
const SELF_EDITABLE_FIELDS = ['email', 'secondaryPhone', 'address', 'preferredContactMethod'];

const notFound = (what) => Object.assign(new Error(`${what} not found`), { statusCode: 404 });

const loanDetailInclude = [
  { association: 'repaymentSchedules', required: false },
  { association: 'creditScore', required: false },
  { association: 'collaterals', required: false },
  { association: 'loanProduct', required: false, attributes: ['id', 'name'] },
  { association: 'coSigner', required: false, attributes: ['id', 'firstName', 'lastName'] },
];

const portalService = {
  async getProfile(clientId) {
    const client = await Client.findByPk(clientId, {
      include: [{
        model: CreditScore,
        as: 'creditScores',
        required: false,
        order: [['created_at', 'DESC']],
        limit: 1,
        separate: true,
      }],
    });
    if (!client) throw notFound('Client');
    return client;
  },

  async updateProfile(clientId, data, userAgent = 'unknown') {
    const client = await Client.findByPk(clientId);
    if (!client) throw notFound('Client');

    const changes = {};
    for (const field of SELF_EDITABLE_FIELDS) {
      if (data[field] !== undefined) changes[field] = data[field];
    }
    if (!Object.keys(changes).length) return client;

    if (changes.email && changes.email !== client.email) {
      const taken = await Client.findOne({ where: { email: changes.email }, attributes: ['id'] });
      if (taken && taken.id !== clientId) {
        throw Object.assign(new Error('That email address is already in use'), { statusCode: 409 });
      }
    }

    await client.update(changes);
    invalidateAuthClient(clientId);

    await AuditLogger.log({
      entityType: 'CLIENT',
      entityId: clientId,
      action: 'UPDATE',
      data: { changes, via: 'portal' },
      actorId: clientId,
      options: { actorType: 'CLIENT', source: userAgent },
    });
    logger.info(`[portal] client ${clientId} updated own profile: ${Object.keys(changes).join(', ')}`);
    return client;
  },

  async getLatestCreditScore(clientId) {
    return CreditScore.findOne({ where: { clientId }, order: [['created_at', 'DESC']] });
  },

  async listLoans(clientId, { cursor, direction, limit = 20, status } = {}) {
    const where = { clientId };
    if (status) where.status = status;
    return paginateKeyset(Loan, {
      keys: [['created_at', 'timestamp'], ['id', 'int']],
      cursor,
      direction,
      limit,
      where,
      include: [
        { association: 'repaymentSchedules', required: false },
        { association: 'loanProduct', required: false, attributes: ['id', 'name'] },
        { association: 'coSigner', required: false, attributes: ['id', 'firstName', 'lastName'] },
      ],
    });
  },

  async getLoan(clientId, loanId) {
    const loan = await Loan.findOne({ where: { id: loanId, clientId }, include: loanDetailInclude });
    // 404 (not 403) for someone else's loan so ids can't be probed.
    if (!loan) throw notFound('Loan');
    return loan;
  },

  async getLoanSchedules(clientId, loanId) {
    const loan = await Loan.findOne({ where: { id: loanId, clientId }, attributes: ['id'] });
    if (!loan) throw notFound('Loan');
    return RepaymentSchedule.findAll({ where: { loanId }, order: [['installment_number', 'ASC']] });
  },

  async getLoanPayments(clientId, loanId) {
    const loan = await Loan.findOne({ where: { id: loanId, clientId }, attributes: ['id'] });
    if (!loan) throw notFound('Loan');
    return Payment.findAll({ where: { loanId }, order: [['transaction_date', 'DESC'], ['id', 'DESC']] });
  },

  async listPayments(clientId, { cursor, direction, limit = 20 } = {}) {
    return paginateKeyset(Payment, {
      keys: [['created_at', 'timestamp'], ['id', 'int']],
      cursor,
      direction,
      limit,
      include: [{
        model: Loan,
        required: true,
        where: { clientId },
        attributes: ['id', 'referenceCode', 'clientId'],
      }],
    });
  },

  /**
   * The client's single most relevant loan: a repayable one if any, else the
   * newest in-flight application. Clients can only hold one open loan at a
   * time (loanService.validateClientOpenLoans), so this is unambiguous.
   */
  async getCurrentLoan(clientId, statuses = CURRENT_LOAN_STATUSES) {
    const loans = await Loan.findAll({
      where: { clientId, status: statuses },
      include: [
        { association: 'repaymentSchedules', required: false },
        { association: 'loanProduct', required: false, attributes: ['id', 'name'] },
      ],
      order: [['created_at', 'DESC']],
    });
    if (!loans.length) return null;
    return loans.sort((a, b) => statuses.indexOf(a.status) - statuses.indexOf(b.status))[0];
  },

  async getDashboard(clientId) {
    const [currentLoan, creditScore, recentPayments, loanCounts] = await Promise.all([
      this.getCurrentLoan(clientId),
      this.getLatestCreditScore(clientId),
      Payment.findAll({
        include: [{ model: Loan, required: true, where: { clientId }, attributes: ['id', 'referenceCode'] }],
        order: [['created_at', 'DESC']],
        limit: 5,
      }),
      Loan.count({ where: { clientId }, group: ['status'] }),
    ]);

    let nextInstallment = null;
    if (currentLoan && REPAYABLE_STATUSES.includes(currentLoan.status)) {
      const next = (currentLoan.repaymentSchedules || [])
        .filter((s) => ['pending', 'partial', 'overdue'].includes(s.status))
        .sort((a, b) => a.installmentNumber - b.installmentNumber)[0];
      if (next) {
        nextInstallment = {
          installmentNumber: next.installmentNumber,
          dueDate: next.dueDate,
          status: next.status,
          amountDue: Number((
            Number(next.totalAmount) - Number(next.paidAmount || 0)
            + Math.max(0, Number(next.penaltyAmount || 0) - Number(next.penaltyPaid || 0))
          ).toFixed(2)),
        };
      }
    }

    const counts = Object.fromEntries(loanCounts.map((r) => [r.status, Number(r.count)]));
    return {
      currentLoan,
      nextInstallment,
      creditScore,
      recentPayments,
      stats: {
        totalLoans: Object.values(counts).reduce((a, b) => a + b, 0),
        closedLoans: counts[LoanStatus.CLOSED] || 0,
      },
    };
  },

  /** Active products, flagged by whether they can be applied for without staff help. */
  async getPortalLoanProducts() {
    const products = await LoanProduct.findAll({ where: { isActive: true }, order: [['name', 'ASC']] });
    return products;
  },
};

portalService.REPAYABLE_STATUSES = REPAYABLE_STATUSES;

module.exports = portalService;
