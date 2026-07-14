const Loan = require('../models/loanModel');
const LoanProduct = require('../models/loanProductModel');
const sequelize = require('../config/sequalize_db');
const { Op } = require('sequelize');
const User = require('../models/userModel');
const AuditService = require('./auditService');
const Client = require('../models/clientModel');
const RepaymentSchedule = require('../models/repaymentScheduleModel');
const CreditScore = require('../models/creditScoreModel');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const { calculateEndDate,isAdmin, CURRENCY_EPSILON } = require('../utils/helpers'); 
const LoanStatus = require('../enums/loanStatus');
const AuditLogger = require('../utils/auditLogger');
const { generateAmortizationSchedule } = require('../utils/loanCalculator');
const { getDecisionFromScore } = require('./riskPolicyService');
const creditScoreService = require('./creditScoreService');
const ledgerService = require('./ledgerService');
const collateralService = require('./collateralService');
const { emitLoanTransaction } = require('../utils/loanTransactionEmitter');
const LoanTransactionType = require('../enums/loanTransactionType');
const CollateralStatus = require('../enums/collateralStatus');
const Document = require('../models/documentModel');
const DocumentCategory = require('../enums/documentCategory');
const LoanDeletionReason = require('../enums/loanDeletionReason');
const DownPaymentType = require('../enums/downPaymentType');
const ContributionType = require('../enums/contributionType');
const MemberContribution = require('../models/memberContributionModel');
const systemConfigService = require('./systemConfigService');

// Loan statuses in which money has already left the institution (disbursed).
const DISBURSED_STATUSES = [
  LoanStatus.DISBURSED,
  LoanStatus.ACTIVE,
  LoanStatus.PARTIALLY_PAID,
  LoanStatus.OVERDUE,
  LoanStatus.DEFAULTED,
];

// Resolves the down payment amount a loan requires, given its product rules.
// The product stores a single `minimumDownPayment` value interpreted either as a
// flat amount or as a percentage (0-100) of the principal via `downPaymentType`.
function computeDownPayment(product, principalAmount) {
  const value = Number.parseFloat(product?.minimumDownPayment ?? 0);
  if (!value || value <= 0) return 0;

  const principal = Number.parseFloat(principalAmount) || 0;
  if (product.downPaymentType === DownPaymentType.PERCENTAGE) {
    return Number(((principal * value) / 100).toFixed(2));
  }
  return Number(value.toFixed(2));
}


// Validates that an amount falls within the product's min/max loan boundaries
function validateAmountAgainstProduct(amount, product) {
  const value = Number.parseFloat(amount);
  const min = product.minLoanAmount ? Number.parseFloat(product.minLoanAmount) : null;
  const max = product.maxLoanAmount ? Number.parseFloat(product.maxLoanAmount) : null;
  if (min !== null && value < min) {
    throw Object.assign(
      new Error(`Requested amount (${value}) is below the minimum allowed for this product (${min})`),
      { statusCode: 422 }
    );
  }
  if (max !== null && value > max) {
    throw Object.assign(
      new Error(`Requested amount (${value}) exceeds the maximum allowed for this product (${max})`),
      { statusCode: 422 }
    );
  }
}

// Calculates monthly payment
function calculateMonthlyPayment(principal, interestRate, termMonths, interestType = 'reducing') {
  const P = Number.parseFloat(principal);
  const r = Number.parseFloat(interestRate) / 100 / 12;
  const n = Number.parseInt(termMonths, 10);

  if (!P || !n) return null;

  if (!r) return (P / n).toFixed(2);

  if (interestType === 'flat') {
    const totalInterest = P * (Number.parseFloat(interestRate) / 100) * (n / 12);
    return ((P + totalInterest) / n).toFixed(2);
  }

  // Reducing balance method
  return (P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)).toFixed(2);
}

/**
 * Builds repayment-schedule DB rows from amortization data, prepending upfront
 * installments for any loan fees and/or a collected down payment.
 *
 * Fees are collected at disbursement (net disbursement), so the fee row is
 * recorded as already paid (installment 0). A down payment reduces the financed
 * principal: the amortization is generated on the net principal, and the down
 * payment is recorded as a paid principal installment (installment 0) so the
 * schedule's total principal still equals the full loan principal.
 *
 * @param {Object} loan - Loan instance (provides id, fees, principalAmount)
 * @param {Array} scheduleData - Output of generateAmortizationSchedule (net principal)
 * @param {Date|string} disbursementDate - Date fees / down payment were collected
 * @param {number} [downPaymentPaid=0] - Down payment already applied to principal
 * @returns {Array} Rows ready for RepaymentSchedule.bulkCreate
 */
function buildScheduleEntries(loan, scheduleData, disbursementDate, downPaymentPaid = 0) {
  const entries = scheduleData.map(entry => ({
    loanId: loan.id,
    installmentNumber: entry.installmentNumber,
    dueDate: entry.dueDate,
    principalAmount: entry.principalAmount,
    interestAmount: entry.interestAmount,
    feesAmount: entry.feesAmount || 0,
    totalAmount: entry.totalAmount,
    paidAmount: 0,
    status: 'pending',
    remainingBalance: entry.remainingBalance
  }));

  const upfrontDate = new Date(disbursementDate).toISOString().split('T')[0];
  const dp = Number(downPaymentPaid || 0);
  const netPrincipal = Number((Number(loan.principalAmount) - dp).toFixed(2));

  // Down payment installment: principal covered upfront, recorded as paid.
  if (dp > 0) {
    entries.unshift({
      loanId: loan.id,
      installmentNumber: 0,
      dueDate: upfrontDate,
      principalAmount: dp,
      interestAmount: 0,
      feesAmount: 0,
      totalAmount: dp,
      paidAmount: dp,
      paidDate: upfrontDate,
      status: 'paid',
      remainingBalance: netPrincipal,
      notes: 'Down payment applied to principal at disbursement'
    });
  }

  const fees = Number(loan.fees || 0);
  if (fees > 0) {
    entries.unshift({
      loanId: loan.id,
      installmentNumber: 0,
      dueDate: upfrontDate,
      principalAmount: 0,
      interestAmount: 0,
      feesAmount: fees,
      totalAmount: fees,
      paidAmount: fees,
      paidDate: upfrontDate,
      status: 'paid',
      remainingBalance: netPrincipal,
      notes: 'Loan service fees collected upfront at disbursement'
    });
  }

  return entries;
}

const loanService = {

  // Get loans (paginated + filtered); returns all loans for management portal
  async getAllLoans({ page = 1, limit = 20, status, search } = {}) {
    try {
      logger.info(`loanService.getAllLoans called (page=${page}, limit=${limit})`);
      const where = {};
      if (status) where.status = status;
      if (search) {
        where[Op.or] = [
          { referenceCode: { [Op.iLike]: `%${search}%` } },
          { '$client.first_name$': { [Op.iLike]: `%${search}%` } },
          { '$client.last_name$': { [Op.iLike]: `%${search}%` } },
        ];
      }
      const offset = (page - 1) * limit;
      const { count, rows } = await Loan.findAndCountAll({
        where,
        limit,
        offset,
        order: [['created_at', 'DESC']],
        distinct: true,
        include: [
          { association: 'client', required: false, attributes: ['id', 'firstName', 'lastName'] },
          { association: 'repaymentSchedules', required: false },
          { association: 'creditScore', required: false },
          { association: 'collaterals', required: false },
          { association: 'transactions', required: false },
        ],
      });
      logger.info(`Retrieved ${rows.length} loans, page=${page}, total=${count})`);
      return { total: count, page, limit, pages: Math.ceil(count / limit), loans: rows };
    } catch (error) {
      logger.error(`Error in getAllLoans: ${error.message}`);
      throw error;
    }
  },

  async getLoanById(id, role, userId) {
    try {
      logger.info(`loanService.getLoanById called for loan ${id} by user ${userId} role ${role}`);
      const loan = await Loan.findByPk(id, {
        include: [
          { association: 'repaymentSchedules', required: false },
          { association: 'creditScore', required: false },
          { association: 'collaterals', required: false },
          { association: 'transactions', required: false },
          { association: 'coSigner', required: false, attributes: ['id', 'firstName', 'lastName'] }
        ]
      });
      if (!loan) return null;

      const numRole = Number(role);
      if (numRole !== 1 && numRole !== 2 && numRole !== 3 && loan.clientId !== userId) {
        return 403; // Access denied
      }

      // Fetch approver/disburser names from audit log
      const actorMap = await AuditService.getActorsByActions('LOAN', id, ['APPROVE', 'DISBURSE']);
      loan.approvedByName = actorMap['APPROVE'] ?? null;
      loan.disbursedByName = actorMap['DISBURSE'] ?? null;
      logger.info(`getLoanById actor names — approvedBy: ${loan.approvedByName}, disbursedBy: ${loan.disbursedByName}`);

      return loan;
    } catch (error) {
      logger.error(`Error in getLoanById (${id}): ${error.message}`);
      throw error;
    }
  },

  /**
   * Shared loan-creation pipeline. Performs authorization, validation, product
   * rule application, payload assembly, persistence (loan + collaterals), audit
   * logging and reload. Used by both the scored and unscored creation flows.
   *
   * @param {Object} data - Loan application data
   * @param {Object} createdByUser - User creating the loan
   * @param {string} userAgent - Source of the action
   * @param {Object} [options]
   * @param {string}  [options.loanStatus=LoanStatus.PENDING] - Status for the new loan
   * @param {boolean} [options.useProvidedTermMonths=false] - Honor data.termMonths over the product default
   * @param {boolean} [options.linkCreditScore=false] - Link the latest credit score to the loan
   * @param {boolean} [options.skipClientValidation=false] - Skip open-loan + eligibility checks (caller already ran them)
   * @param {Object}  [options.auditExtra=null] - Extra data merged into the CREATE audit entry
   * @returns {Promise<Object>} Created loan with associations reloaded
   */
  async processLoanCreation(data, createdByUser, userAgent, options = {}) {
    const {
      loanStatus = LoanStatus.PENDING,
      useProvidedTermMonths = false,
      linkCreditScore = false,
      skipClientValidation = false,
      auditExtra = null,
    } = options;

    const creatorId = createdByUser?.id || null;
    const role = Number(createdByUser?.role_id ?? createdByUser?.role);
    if (!isAdmin(role)) {
      throw new Error('User not authorized to create loans');
    }

    if (!data.clientId) throw new Error('clientId is required');
    if (!data.loanProductId) throw new Error('loanProductId is required');

    // Validate client has no conflicting open loans (unless the caller already did)
    if (!skipClientValidation) {
      await validateClientOpenLoans(data.clientId);
    }

    // Load loan product
    const product = await LoanProduct.findByPk(data.loanProductId);
    if (!product) throw new Error('Invalid loan product selected');
    collateralService.validateCollateralInputAgainstProduct(product, data.collateral);

    // Validate loan amount against product boundaries
    validateAmountAgainstProduct(data.principalAmount, product);

    // Apply product rules
    const interestRate = product.interestRate;
    const interestType = product.interestType;
    const termMonths = useProvidedTermMonths
      ? (data.termMonths || product.repaymentPeriodMonths)
      : product.repaymentPeriodMonths;
    const loanCurrency = product.currency || 'KES';
    const fees = product.fees || 0;

    // Validate client eligibility (unless the caller already did) and co-signer
    if (!skipClientValidation) {
      await fetchAndValidateClient(data.clientId);
    }
    validateCoSigner(data, product);

    // Calculate derived values
    const endDate = calculateEndDate(data.startDate, termMonths);
    const installmentAmount = calculateMonthlyPayment(
      data.principalAmount,
      interestRate,
      termMonths,
      interestType
    );

    // Resolve the down payment required for this loan from the product rules
    const downPaymentRequired = computeDownPayment(product, data.principalAmount);

    // Build loan payload
    const loanPayload = {
      clientId: data.clientId,
      loanProductId: data.loanProductId,
      principalAmount: data.principalAmount,
      currency: loanCurrency,

      interestRate,
      interestType,
      termMonths,

      startDate: data.startDate,
      endDate,
      installmentAmount,
      outstandingBalance: data.principalAmount,

      fees,
      penalties: 0,

      downPaymentRequired,
      downPaymentPaid: 0,

      collateral: data.collateral,
      coSignerId: data.coSignerId,
      notes: data.notes,

      status: loanStatus,

      referenceCode: `LN-${uuidv4().split('-')[0].toUpperCase()}`,
      createdBy: creatorId
    };

    const transaction = await sequelize.transaction();
    let newLoan;
    try {
      newLoan = await Loan.create(loanPayload, { transaction });
      await collateralService.createLoanCollaterals({
        loan: newLoan,
        product,
        collateral: data.collateral,
        actorId: creatorId,
        transaction
      });

      if (linkCreditScore) {
        const latestScore = await CreditScore.findOne({
          where: { clientId: data.clientId },
          order: [['created_at', 'DESC']],
          transaction
        });
        if (latestScore) {
          await latestScore.update({
            loanId: newLoan.id,
            notes: `Auto-scored for loan ${newLoan.referenceCode}`
          }, { transaction });
        }
      }

      await transaction.commit();
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }

    // Validate the created loan before logging
    if (!newLoan?.id) {
      logger.error('Loan creation returned invalid result', { newLoan });
      throw new Error('Loan creation failed: invalid loan object returned');
    }

    // Reload loan with associations
    await newLoan.reload({
      include: [
        { association: 'repaymentSchedules', required: false },
        { association: 'creditScore', required: false },
        { association: 'collaterals', required: false }
      ]
    });

    // Log to audit table after successful creation
    await AuditLogger.log({
      entityType: 'LOAN',
      entityId: newLoan.id,
      action: 'CREATE',
      data: auditExtra ? { loanPayload, ...auditExtra } : loanPayload,
      actorId: creatorId,
      options: {
        actorType: 'USER',
        source: userAgent || 'unknown'
      }
    });

    logger.info(
      `Loan created: id=${newLoan.id} reference=${newLoan.referenceCode} status=${loanStatus} by user ${creatorId}`
    );

    return newLoan;
  },

  async createLoanWithoutCreditScoring(data, createdByUser, userAgent) {
    try {
      logger.info(`loanService.createLoanWithoutCreditScoring called by user ${createdByUser?.id || null}`);
      return await this.processLoanCreation(data, createdByUser, userAgent, {
        loanStatus: LoanStatus.PENDING,
      });
    } catch (error) {
      logger.error(`Error in createLoanWithoutCreditScoring: ${error.message}`);
      throw error;
    }
  },

  /**
   * Create a loan with integrated credit scoring and risk policy evaluation
   * Runs the application through credit scoring and risk policy engines
   * before approving or rejecting the loan application
   * @param {Object} data - Loan application data
   * @param {Object} createdByUser - User creating the loan
   * @param {string} userAgent - Source of the action
   * @returns {Promise<Object>} Created loan with risk assessment data
   */
  async createLoan(data, createdByUser, userAgent = 'unknown') {
    try {
      const creatorId = createdByUser?.id || null;
      const role = Number(createdByUser?.role_id ?? createdByUser?.role);
      if (!isAdmin(role)) {
        throw new Error('User not authorized to create loans');
      }
      logger.info(`loanService.createLoan (with credit scoring) called by user ${creatorId}`);

      if (!data.clientId) throw new Error('clientId is required');
      if (!data.loanProductId) throw new Error('loanProductId is required');
      if (!data.principalAmount) throw new Error('principalAmount is required');
      if (!data.startDate) throw new Error('startDate is required');

      // Gate: ensure client has no conflicting open loans and is eligible before scoring
      await validateClientOpenLoans(data.clientId);
      await fetchAndValidateClient(data.clientId);

      // Score client via shared service (also loads loans internally)
      const { riskScore, riskGrade, riskDti, creditLimit } = await creditScoreService.computeAndSave(
        data.clientId,
        creatorId,
        userAgent,
        { requestedTenure: data.termMonths || 12 }
      );

      const riskDecision = getDecisionFromScore(riskScore);

      logger.info(
        `Credit scoring result for client ${data.clientId}: score=${riskScore}, grade=${riskGrade}, decision=${riskDecision}, dti=${riskDti.toFixed(2)}, limit=${creditLimit}`
      );

      // Reject if requested principal exceeds computed credit limit
      if (Number(data.principalAmount) > creditLimit) {
        throw Object.assign(
          new Error(`Requested amount (${data.principalAmount}) exceeds client credit limit (${creditLimit})`),
          { statusCode: 422 }
        );
      }

      // Determine loan status based on policy decision
      // APPROVED -> under_review (admin will approve); otherwise -> pending (manual review)
      const loanStatus = riskDecision === 'APPROVED' ? LoanStatus.UNDER_REVIEW : LoanStatus.PENDING;
      logger.info(`Loan application ${riskDecision === 'APPROVED' ? 'passed' : 'did not pass'} automatic checks - status=${loanStatus}`);

      const newLoan = await this.processLoanCreation(data, createdByUser, userAgent, {
        loanStatus,
        useProvidedTermMonths: true,
        linkCreditScore: true,
        skipClientValidation: true,
        auditExtra: {
          scoringResult: { riskScore, riskGrade, riskDti, creditLimit, policyDecision: riskDecision }
        },
      });

      logger.info(
        `Loan created with credit scoring: id=${newLoan.id} reference=${newLoan.referenceCode} ` +
        `riskScore=${riskScore} riskGrade=${riskGrade} decision=${riskDecision} by user ${creatorId}`
      );

      return newLoan;

    } catch (error) {
      logger.error(`Error in createLoan (with credit scoring): ${error.message}`);
      throw error;
    }
  },

  async updateLoan(id, data, updatorId = null, userAgent = 'unknown') {
    try {
      logger.info(`loanService.updateLoan called for loan ${id}`);
      const loan = await Loan.findByPk(id, {
        include: [
          { association: 'repaymentSchedules', required: false },
          { association: 'creditScore', required: false },
          { association: 'collaterals', required: false },
          { association: 'transactions', required: false }
        ]
      });
      if (!loan) throw new Error('Loan not found');

      const oldStatus = loan.status;

      // Recalculate if key fields changed
      if (data.principalAmount || data.interestRate || data.termMonths || data.interestType) {
        const principal = data.principalAmount || loan.principalAmount;
        const rate = data.interestRate || loan.interestRate;
        const term = data.termMonths || loan.termMonths;
        const type = data.interestType || loan.interestType;

        data.installmentAmount = calculateMonthlyPayment(principal, rate, term, type);
        data.paymentSchedule = {
          type,
          termMonths: term,
          monthlyPayment: data.installmentAmount,
        };
      }

      await loan.update(data);

      // Log status change to audit table if status was updated
      const auditData = data.status && data.status !== oldStatus
        ? {
            statusChange: {
              from: oldStatus,
              to: data.status,
              timestamp: new Date()
            }
          }
        : { changes: data };

      await AuditLogger.log({
        entityType: 'LOAN',
        entityId: id,
        action: 'UPDATE',
        data: auditData,
        actorId: updatorId || 1,
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      // Reload with associations
      await loan.reload({
        include: [
          { association: 'repaymentSchedules', required: false },
          { association: 'creditScore', required: false },
          { association: 'collaterals', required: false },
          { association: 'transactions', required: false }
        ]
      });

      if (data.status && data.status !== oldStatus) {
        await collateralService.syncCollateralLifecycleForLoanStatus(loan, data.status, updatorId, {
          notes: data.notes
        });
      }

      logger.info(`Loan ${id} updated successfully by user ${updatorId}`);
      return loan;
    } catch (error) {
      logger.error(`Error in updateLoan (${id}): ${error.message}`);
      throw error;
    }
  },

  async approveLoan(id, approvalDate, approverId = null, userAgent = 'unknown') {
    try {
      logger.info(`loanService.approveLoan called for loan ${id}`);
      const loan = await Loan.findByPk(id, {
        include: [
          { association: 'repaymentSchedules', required: false },
          { association: 'creditScore', required: false },
          { association: 'collaterals', required: false }
        ]
      });
      if (!loan) throw new Error('Loan not found');

      // Validate loan can be approved
      if (loan.status !== LoanStatus.PENDING && loan.status !== LoanStatus.IN_REVIEW && loan.status !== LoanStatus.UNDER_REVIEW) {
        throw new Error(`Loan cannot be approved. Current status: ${loan.status}. Loan must be pending, in_review, or under_review.`);
      }

      // If the loan product requires collateral, at least one collateral document must be uploaded
      const product = await LoanProduct.findByPk(loan.loanProductId);
      if (product && product.requiresCollateral) {
        const collateralDocCount = await Document.count({
          where: {
            loanId: loan.id,
            documentCategory: DocumentCategory.LOAN_COLLATERAL,
            status: 'active',
          },
        });
        if (collateralDocCount === 0) {
          throw new Error(
            'Loan cannot be approved. The loan product requires collateral but no collateral documents have been uploaded for this loan.'
          );
        }

        // All collateral records must be verified before approval
        const collaterals = loan.collaterals || [];
        if (collaterals.length > 0) {
          const unverified = collaterals.filter((c) => c.status !== CollateralStatus.VERIFIED);
          if (unverified.length > 0) {
            const types = unverified.map((c) => c.collateralType).join(', ');
            throw new Error(
              `Loan cannot be approved. ${unverified.length} collateral record(s) are not yet verified: ${types}. Verify each collateral before approving.`
            );
          }
        }
      }

      // Approver must not be the same user who created the loan
      if (approverId && loan.createdBy && Number(approverId) === Number(loan.createdBy)) {
        throw new Error('Loan cannot be approved. The approver cannot be the same user who created the loan.');
      }

      // Parse and validate approval date
      const approval = new Date(approvalDate);
      if (Number.isNaN(approval.getTime())) {
        throw new TypeError('Invalid approval date');
      }

      // Update loan with approval info
      await loan.update({
        approvalDate: approval.toISOString().split('T')[0],
        status: LoanStatus.APPROVED
      });

      // Reload with associations
      await loan.reload({
        include: [
          { association: 'repaymentSchedules', required: false },
          { association: 'creditScore', required: false },
          { association: 'collaterals', required: false },
          { association: 'transactions', required: false }
        ]
      });

      await collateralService.syncCollateralLifecycleForLoanStatus(loan, LoanStatus.APPROVED, approverId, {
        notes: `Loan ${loan.referenceCode} approved`
      });

      // Log to audit
      await AuditLogger.log({
        entityType: 'LOAN',
        entityId: id,
        action: 'APPROVE',
        data: {
          approvalDate: approval.toISOString().split('T')[0],
          status: LoanStatus.APPROVED
        },
        actorId: approverId || 1,
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      logger.info(`Loan ${id} approved on ${approval.toISOString().split('T')[0]} by user ${approverId}`);
      return loan;

    } catch (error) {
      logger.error(`Error in approveLoan (${id}): ${error.message}`);
      throw error;
    }
  },

  async rejectLoan(id, rejectionNote, rejectorId = null, userAgent = 'unknown') {
    try {
      logger.info(`loanService.rejectLoan called for loan ${id}`);
      const REJECTABLE = [LoanStatus.PENDING, LoanStatus.IN_REVIEW, LoanStatus.UNDER_REVIEW, LoanStatus.PENDING_REVERIFICATION, LoanStatus.VERIFIED];
      const loan = await Loan.findByPk(id, {
        include: [
          { association: 'repaymentSchedules', required: false },
          { association: 'creditScore', required: false },
          { association: 'collaterals', required: false }
        ]
      });
      if (!loan) throw new Error('Loan not found');

      if (!REJECTABLE.includes(loan.status)) {
        throw new Error(`Loan cannot be rejected. Current status: ${loan.status}.`);
      }

      const previousStatus = loan.status;
      await loan.update({
        status: LoanStatus.REJECTED,
        ...(rejectionNote ? { notes: rejectionNote } : {})
      });

      await loan.reload({
        include: [
          { association: 'repaymentSchedules', required: false },
          { association: 'creditScore', required: false },
          { association: 'collaterals', required: false },
          { association: 'transactions', required: false }
        ]
      });

      await collateralService.syncCollateralLifecycleForLoanStatus(loan, LoanStatus.REJECTED, rejectorId, {
        notes: rejectionNote || `Loan ${loan.referenceCode} rejected`
      });

      await AuditLogger.log({
        entityType: 'LOAN',
        entityId: id,
        action: 'REJECT',
        data: { previousStatus, rejectionNote, status: LoanStatus.REJECTED },
        actorId: rejectorId || 1,
        options: { actorType: 'USER', source: userAgent }
      });

      logger.info(`Loan ${id} rejected by user ${rejectorId}. Previous status: ${previousStatus}`);
      return loan;
    } catch (error) {
      logger.error(`Error in rejectLoan (${id}): ${error.message}`);
      throw error;
    }
  },

  /**
   * Soft-deletes a loan, posting the appropriate ledger entries.
   *
   * - Disbursed/active loans (gated by config): the remaining principal
   *   (outstandingBalance) is written off. Repayments already made are left
   *   untouched (they recovered disbursed cash and earned interest).
   * - Pre-disbursement loans: any down payment already collected is transferred
   *   to the member's contributions (savings); otherwise no ledger entry.
   *
   * @param {number} id
   * @param {Object} options - { reason, notes }
   * @param {number} deletorId
   * @param {string} userAgent
   */
  async deleteLoan(id, options = {}, deletorId = null, userAgent = 'unknown') {
    const { reason, notes = null } = options;
    const t = await sequelize.transaction();
    try {
      logger.info(`loanService.deleteLoan called for loan ${id} (reason: ${reason})`);

      // A deletion reason is mandatory and must be a known value
      if (!reason || !Object.values(LoanDeletionReason).includes(reason)) {
        throw Object.assign(
          new Error(
            `A valid deletion reason is required. Allowed: ${Object.values(LoanDeletionReason).join(', ')}`
          ),
          { statusCode: 422 }
        );
      }

      const loan = await Loan.findByPk(id, {
        include: [
          { association: 'repaymentSchedules', required: false },
          { association: 'creditScore', required: false },
          { association: 'collaterals', required: false }
        ],
        transaction: t,
      });
      if (!loan) throw Object.assign(new Error('Loan not found'), { statusCode: 404 });

      const originalData = loan.toJSON();
      const previousStatus = loan.status;
      const isDisbursed = DISBURSED_STATUSES.includes(previousStatus) || !!loan.disbursementDate;

      // Guard: deleting a disbursed/active loan is gated behind a system config flag
      if (isDisbursed) {
        const allowed = await systemConfigService.getConfigValue(
          'loan.deletion_of_active_loan_enabled',
          'boolean',
          false
        );
        if (!allowed) {
          throw Object.assign(
            new Error('Deleting an active (disbursed) loan is disabled by system configuration'),
            { statusCode: 403 }
          );
        }
      }

      const ledgerEffect = {};

      if (isDisbursed) {
        // Money is out. Repayments stay as-is (they recovered disbursed cash and
        // earned interest). Write off the remaining principal (= outstandingBalance,
        // which tracks principal only) against Loans Receivable.
        const remainingPrincipal = Number((Number(loan.outstandingBalance) || 0).toFixed(2));
        if (remainingPrincipal > CURRENCY_EPSILON) {
          await ledgerService.postWriteOffEntry(loan, remainingPrincipal, deletorId, t);
          ledgerEffect.writeOff = remainingPrincipal;
        }
      } else {
        // Pre-disbursement. No principal was ever lent, so nothing to write off.
        // Any down payment already collected is transferred to the member's
        // contributions (savings) so their money is preserved.
        const heldDownPayment = Number((Number(loan.downPaymentPaid) || 0).toFixed(2));
        if (heldDownPayment > CURRENCY_EPSILON) {
          const { entry } = await ledgerService.postDownPaymentToContributionEntry(
            loan,
            heldDownPayment,
            deletorId,
            t
          );
          await MemberContribution.create({
            clientId: loan.clientId,
            amount: heldDownPayment,
            contributionDate: new Date().toISOString().split('T')[0],
            type: ContributionType.CONTRIBUTION,
            notes: `Down payment refund from deleted Loan #${loan.id} (${loan.referenceCode})`,
            journalEntryId: entry.id,
            createdBy: deletorId || null,
          }, { transaction: t });
          ledgerEffect.downPaymentToContribution = heldDownPayment;
        }
      }

      // Soft delete: change status to 'deleted' instead of destroying the record
      await loan.update({ status: LoanStatus.DELETED }, { transaction: t });

      await collateralService.syncCollateralLifecycleForLoanStatus(loan, LoanStatus.DELETED, deletorId, {
        notes: `Loan ${loan.referenceCode} deleted`,
        transaction: t,
      });

      await AuditLogger.log({
        entityType: 'LOAN',
        entityId: id,
        action: 'DELETE',
        data: {
          previousStatus,
          newStatus: LoanStatus.DELETED,
          reason,
          notes,
          disbursed: isDisbursed,
          ledgerEffect,
          originalData,
        },
        actorId: deletorId || 1,
        options: { actorType: 'USER', source: userAgent },
      });

      await t.commit();
      logger.warn(
        `Loan ${id} marked as deleted (reason: ${reason}, previous: ${previousStatus}, ` +
        `effect: ${JSON.stringify(ledgerEffect)})`
      );
      return { message: 'Loan marked as deleted successfully', id, status: LoanStatus.DELETED };
    } catch (error) {
      await t.rollback();
      logger.error(`Error in deleteLoan (${id}): ${error.message}`);
      throw error;
    }
  },

  /**
   * Disburse a loan and generate its repayment schedule
   * @param {number} loanId - The loan ID
   * @param {Date|string} disbursementDate - Date when loan was disbursed
   * @param {number} actorId - User ID performing the action
   * @param {string} userAgent - Source of the action
   * @returns {Promise<Object>} Updated loan and generated schedule
   */
  async disburseLoan(loanId, disbursementDate, actorId = null, userAgent = 'system') {
    try {
      logger.info(`Disbursing loan ${loanId} on ${disbursementDate}`);

      const loan = await Loan.findByPk(loanId, {
        include: [
          { association: 'repaymentSchedules', required: false },
          { association: 'creditScore', required: false },
          { association: 'collaterals', required: false }
        ]
      });
      if (!loan) {
        throw new Error('Loan not found');
      }

      // Validate loan can be disbursed
      if (loan.status !== LoanStatus.APPROVED) {
        throw new Error(`Loan cannot be disbursed. Current status: ${loan.status}. Loan must be approved first.`);
      }

      if (loan.disbursementDate) {
        throw new Error('Loan has already been disbursed');
      }

      // Enforce down payment collection before disbursement
      const downPaymentRequired = Number(loan.downPaymentRequired || 0);
      const downPaymentPaid = Number(loan.downPaymentPaid || 0);
      if (downPaymentRequired > 0 && downPaymentPaid + CURRENCY_EPSILON < downPaymentRequired) {
        throw Object.assign(
          new Error(
            `Loan cannot be disbursed. Down payment of ${downPaymentRequired} required, ` +
            `only ${downPaymentPaid} collected.`
          ),
          { statusCode: 422 }
        );
      }

      // Check if schedule already exists
      const existingSchedule = await RepaymentSchedule.findAll({ 
        where: { loanId },
        limit: 1 
      });

      if (existingSchedule.length > 0) {
        throw new Error('Repayment schedule already exists for this loan');
      }

      const disbursement = new Date(disbursementDate);

      // Update loan with disbursement info
      await loan.update({
        disbursementDate: disbursement.toISOString().split('T')[0],
        status: LoanStatus.DISBURSED
      });

      await collateralService.syncCollateralLifecycleForLoanStatus(loan, LoanStatus.DISBURSED, actorId, {
        notes: `Loan ${loan.referenceCode} disbursed`
      });

      // A down payment reduces the financed principal: amortize on the net amount
      // so the borrower's interest is calculated on what they actually owe.
      const financedPrincipal = Number((Number(loan.principalAmount) - downPaymentPaid).toFixed(2));

      // Generate repayment schedule (on the net, post-down-payment principal)
      const scheduleData = generateAmortizationSchedule({
        principal: financedPrincipal,
        interestRate: loan.interestRate,
        termMonths: loan.termMonths,
        interestType: loan.interestType,
        startDate: disbursement,
        paymentFrequency: loan.paymentFrequency || 'monthly'
      });

      // Create schedule entries in database (includes the down payment as a paid
      // installment when one was collected)
      const scheduleEntries = buildScheduleEntries(loan, scheduleData, disbursement, downPaymentPaid);

      const createdSchedule = await RepaymentSchedule.bulkCreate(scheduleEntries);

      // Update loan with next payment date (first outstanding installment)
      if (scheduleData.length > 0) {
        await loan.update({
          nextPaymentDate: scheduleData[0].dueDate
        });
      }

      // Post ledger entry for disbursement
      await ledgerService.postDisbursementEntry(loan);

      // Apply any collected down payment against the principal (reduces the
      // receivable to the net financed principal). Recorded as a paid principal
      // installment above and as a loan transaction below.
      if (downPaymentPaid > 0) {
        await ledgerService.postDownPaymentApplicationEntry(loan, downPaymentPaid, actorId);

        const reducedBalance = Math.max(
          0,
          Number((Number(loan.outstandingBalance) - downPaymentPaid).toFixed(2))
        );
        const newAmountRepaid = Number((Number(loan.amountRepaid || 0) + downPaymentPaid).toFixed(2));
        await loan.update({
          outstandingBalance: reducedBalance,
          amountRepaid: newAmountRepaid,
          noOfRepayments: Number(loan.noOfRepayments || 0) + 1,
        });

        // Record the down payment as a loan transaction (principal repayment)
        emitLoanTransaction({
          loanId: loan.id,
          transactionType: LoanTransactionType.DOWNPAYMENT,
          direction: 'CREDIT',
          amount: downPaymentPaid,
          currency: loan.currency,
          principalBalance: reducedBalance,
          interestBalance: 0,
          feesBalance: Number(loan.fees || 0),
          penaltiesBalance: Number(loan.penalties || 0),
          totalBalance: reducedBalance,
          referenceType: 'loan',
          referenceId: loan.id,
          transactionDate: disbursement,
          notes: `Down payment applied to principal – Loan ${loan.referenceCode}`,
          createdBy: actorId || null,
        });
      }

      // Emit loan transaction event for disbursement
      emitLoanTransaction({
        loanId: loan.id,
        transactionType: LoanTransactionType.DISBURSEMENT,
        direction: 'DEBIT',
        amount: Number(loan.principalAmount),
        currency: loan.currency,
        principalBalance: Number(loan.outstandingBalance),
        interestBalance: 0,
        feesBalance: Number(loan.fees || 0),
        penaltiesBalance: Number(loan.penalties || 0),
        totalBalance: Number(loan.outstandingBalance),
        referenceType: 'loan',
        referenceId: loan.id,
        transactionDate: disbursement,
        notes: `Loan ${loan.referenceCode} disbursed`,
        createdBy: actorId || null,
      });

      // Record upfront fees as a separate loan transaction (deducted from disbursement proceeds)
      const feesAtDisbursement = Number(loan.fees || 0);
      if (feesAtDisbursement > 0) {
        emitLoanTransaction({
          loanId: loan.id,
          transactionType: LoanTransactionType.FEE,
          direction: 'CREDIT',
          amount: feesAtDisbursement,
          currency: loan.currency,
          principalBalance: Number(loan.outstandingBalance),
          interestBalance: 0,
          feesBalance: feesAtDisbursement,
          penaltiesBalance: Number(loan.penalties || 0),
          totalBalance: Number(loan.outstandingBalance),
          referenceType: 'loan',
          referenceId: loan.id,
          transactionDate: disbursement,
          notes: `Upfront loan service fees collected at disbursement – Loan ${loan.referenceCode}`,
          createdBy: actorId || null,
        });
      }

      // Reload loan to get updated data
      await loan.reload({
        include: [
          { association: 'repaymentSchedules', required: false },
          { association: 'creditScore', required: false },
          { association: 'collaterals', required: false },
          {association: 'transactions', required: false }
        ]
      });

      // Log to audit
      await AuditLogger.log({
        entityType: 'LOAN',
        entityId: loanId,
        action: 'DISBURSE',
        data: {
          disbursementDate: disbursement.toISOString().split('T')[0],
          installmentsCount: scheduleEntries.length,
          status: loan.status
        },
        actorId: actorId || 1,
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      logger.info(`Loan ${loanId} disbursed successfully with ${createdSchedule.length} installments`);
      
      return {
        loan,
        schedule: createdSchedule,
        installmentsCount: createdSchedule.length
      };

    } catch (error) {
      logger.error(`Error disbursing loan ${loanId}: ${error.message}`);
      throw error;
    }
  },

  /**
   * Generate repayment schedule for a loan after disbursement
   * @param {number} loanId - The loan ID
   * @param {Date|string} disbursementDate - Date when loan was disbursed
   * @param {number} actorId - User ID performing the action
   * @param {string} userAgent - Source of the action
   * @returns {Promise<Array>} Generated schedule entries
   */
  async generateRepaymentSchedule(loanId, disbursementDate, actorId = null, userAgent = 'system') {
    try {
      logger.info(`Generating repayment schedule for loan ${loanId}`);

      const loan = await Loan.findByPk(loanId, {
        include: [{ association: 'repaymentSchedules', required: false }]
      });
      if (!loan) {
        throw new Error('Loan not found');
      }

      // Check if schedule already exists
      const existingSchedule = await RepaymentSchedule.findAll({ 
        where: { loanId },
        limit: 1 
      });

      if (existingSchedule.length > 0) {
        logger.warn(`Repayment schedule already exists for loan ${loanId}`);
        throw new Error('Repayment schedule already exists. Use recalculateRepaymentSchedule to update.');
      }

      // Update loan with disbursement date
      const disbursement = new Date(disbursementDate);
      await loan.update({
        disbursementDate: disbursement.toISOString().split('T')[0],
        status: LoanStatus.DISBURSED
      });

      // Generate schedule using loan calculator
      const scheduleData = generateAmortizationSchedule({
        principal: loan.principalAmount,
        interestRate: loan.interestRate,
        termMonths: loan.termMonths,
        interestType: loan.interestType,
        startDate: disbursement,
        paymentFrequency: loan.paymentFrequency || 'monthly'
      });

      // Create schedule entries in database
      const scheduleEntries = buildScheduleEntries(loan, scheduleData, disbursement);

      const createdSchedule = await RepaymentSchedule.bulkCreate(scheduleEntries);

      // Update loan with next payment date (first installment)
      if (scheduleData.length > 0) {
        await loan.update({
          nextPaymentDate: scheduleData[0].dueDate
        });
      }

      // Log to audit
      await AuditLogger.log({
        entityType: 'LOAN',
        entityId: loanId,
        action: 'GENERATE_SCHEDULE',
        data: {
          disbursementDate,
          installmentsCount: scheduleEntries.length
        },
        actorId: actorId || 1,
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      logger.info(`Generated ${createdSchedule.length} installments for loan ${loanId}`);
      return createdSchedule;

    } catch (error) {
      logger.error(`Error generating repayment schedule for loan ${loanId}: ${error.message}`);
      throw error;
    }
  },

  /**
   * Recalculate repayment schedule for a loan (e.g., after restructuring)
   * Deletes existing schedule and creates new one
   * @param {number} loanId - The loan ID
   * @param {Object} options - Optional parameters for recalculation
   * @param {Date|string} options.newDisbursementDate - New disbursement date (optional)
   * @param {number} options.newPrincipal - New principal amount (optional)
   * @param {number} options.newInterestRate - New interest rate (optional)
   * @param {number} options.newTermMonths - New term in months (optional)
   * @param {number} actorId - User ID performing the action
   * @param {string} userAgent - Source of the action
   * @returns {Promise<Array>} Recalculated schedule entries
   */
  async recalculateRepaymentSchedule(loanId, options = {}, actorId = null, userAgent = 'system') {
    try {
      logger.info(`Recalculating repayment schedule for loan ${loanId}`);

      const loan = await Loan.findByPk(loanId, {
        include: [{ association: 'repaymentSchedules', required: false }]
      });
      if (!loan) {
        throw new Error('Loan not found');
      }

      // Delete existing schedule
      const deletedCount = await RepaymentSchedule.destroy({ 
        where: { loanId } 
      });
      logger.info(`Deleted ${deletedCount} existing schedule entries for loan ${loanId}`);

      // Update loan parameters if provided
      const updates = {};
      if (options.newDisbursementDate) {
        updates.disbursementDate = new Date(options.newDisbursementDate).toISOString().split('T')[0];
      }
      if (options.newPrincipal) {
        updates.principalAmount = options.newPrincipal;
        updates.outstandingBalance = options.newPrincipal;
      }
      if (options.newInterestRate) {
        updates.interestRate = options.newInterestRate;
      }
      if (options.newTermMonths) {
        updates.termMonths = options.newTermMonths;
        updates.endDate = calculateEndDate(
          updates.disbursementDate || loan.disbursementDate,
          options.newTermMonths
        );
      }

      if (Object.keys(updates).length > 0) {
        await loan.update(updates);
        await loan.reload({
          include: [{ association: 'repaymentSchedules', required: false }]
        });
      }

      // Validate disbursement date
      if (!loan.disbursementDate) {
        throw new Error('Cannot recalculate schedule: loan has no disbursement date');
      }

      // Generate new schedule
      const scheduleData = generateAmortizationSchedule({
        principal: loan.principalAmount,
        interestRate: loan.interestRate,
        termMonths: loan.termMonths,
        interestType: loan.interestType,
        startDate: loan.disbursementDate,
        paymentFrequency: loan.paymentFrequency || 'monthly'
      });

      // Create new schedule entries
      const scheduleEntries = buildScheduleEntries(loan, scheduleData, loan.disbursementDate);

      const createdSchedule = await RepaymentSchedule.bulkCreate(scheduleEntries);

      // Update loan with next payment date
      if (scheduleData.length > 0) {
        await loan.update({
          nextPaymentDate: scheduleData[0].dueDate,
          installmentAmount: scheduleData[0].totalAmount
        });

        // Reload with associations
        await loan.reload({
          include: [{ association: 'repaymentSchedules', required: false }]
        });
      }

      // Log to audit
      await AuditLogger.log({
        entityType: 'LOAN',
        entityId: loanId,
        action: 'RECALCULATE_SCHEDULE',
        data: {
          changes: options,
          installmentsCount: scheduleEntries.length
        },
        actorId: actorId || 1,
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      logger.info(`Recalculated ${createdSchedule.length} installments for loan ${loanId}`);
      return createdSchedule;

    } catch (error) {
      logger.error(`Error recalculating repayment schedule for loan ${loanId}: ${error.message}`);
      throw error;
    }
  },

  /**
   * Get repayment schedule for a loan
   * @param {number} loanId - The loan ID
   * @returns {Promise<Array>} Schedule entries
   */
  async getRepaymentSchedule(loanId) {
    try {
      logger.info(`Fetching repayment schedule for loan ${loanId}`);
      
      const schedule = await RepaymentSchedule.findAll({
        where: { loanId },
        order: [['installmentNumber', 'ASC']]
      });

      return schedule;
    } catch (error) {
      logger.error(`Error fetching repayment schedule for loan ${loanId}: ${error.message}`);
      throw error;
    }
  },

  /**
   * Update principal amount before loan approval
   * Only allowed for loans in PENDING, IN_REVIEW, or UNDER_REVIEW status
   * @param {number} loanId - The loan ID
   * @param {number} newPrincipalAmount - The new principal amount
   * @param {number} actorId - User ID performing the action
   * @param {string} userAgent - Source of the action
   * @returns {Promise<Object>} Updated loan with recalculated installment
   */
  async updatePrincipalAmount(loanId, newPrincipalAmount, actorId = null, userAgent = 'unknown') {
    try {
      logger.info(`loanService.updatePrincipalAmount called for loan ${loanId}`);

      // Fetch loan with product details
      const loan = await Loan.findByPk(loanId, {
        include: [
          { association: 'creditScore', required: false },
          { association: 'loanProduct', required: false }
        ]
      });

      if (!loan) {
        throw new Error('Loan not found');
      }

      // Validate loan status - only allow updates before approval
      const updatableStatuses = [LoanStatus.PENDING, LoanStatus.IN_REVIEW, LoanStatus.UNDER_REVIEW, LoanStatus.APPROVED];
      if (!updatableStatuses.includes(loan.status)) {
        throw new Error(
          `Cannot update principal amount for loan in '${loan.status}' status. ` +
          `Only allowed for loans in pending, in_review, under_review or approved status`
        );
      }

      // Validate new principal amount --must be a positive number
      const newPrincipal = Number.parseFloat(newPrincipalAmount);
      if (Number.isNaN(newPrincipal) || newPrincipal <= 0) {
        throw new Error('Principal amount must be a positive number');
      }

      // Check if amount is different
      if (newPrincipal === loan.principalAmount) {
        throw new Error('New principal amount is the same as current amount');
      }

      // Validate against loan product min/max if product exists
      if (loan.loanProduct) {
        validateAmountAgainstProduct(newPrincipal, loan.loanProduct);
      }

      // Store old values for audit
      const oldPrincipal = loan.principalAmount;
      const oldInstallmentAmount = loan.installmentAmount;
      const difference = newPrincipal - oldPrincipal;
      const differenceType = difference > 0 ? 'top-up' : 'reduction';

      // ── Down payment recalculation ─────────────────────────────────────────
      // For percentage-type products the required amount scales with the principal.
      // Flat-amount products are unchanged, but we still need to handle excess if
      // the principal was reduced below what has already been paid.
      const product = loan.loanProduct;
      const oldDownPaymentRequired = Number(loan.downPaymentRequired || 0);
      const downPaymentPaid       = Number(loan.downPaymentPaid || 0);

      let newDownPaymentRequired = oldDownPaymentRequired;
      if (product && product.downPaymentType === DownPaymentType.PERCENTAGE) {
        newDownPaymentRequired = computeDownPayment(product, newPrincipal);
      }
      // If already-paid down payment exceeds the new requirement, apply the
      // excess against the outstanding balance (credit the client).
      let excessDownPayment = 0;
      if (downPaymentPaid > newDownPaymentRequired) {
        excessDownPayment = Number((downPaymentPaid - newDownPaymentRequired).toFixed(2));
        logger.info(
          `Loan ${loanId}: excess down payment of ${excessDownPayment} will be credited to outstanding balance`
        );
      }

      // Recalculate monthly installment with new principal
      const newInstallmentAmount = calculateMonthlyPayment(
        newPrincipal,
        loan.interestRate,
        loan.termMonths,
        loan.interestType
      );

       const updateData = {
        principalAmount: newPrincipal,
        outstandingBalance: newPrincipal,
        installmentAmount: newInstallmentAmount,
        ...(newDownPaymentRequired !== oldDownPaymentRequired && {
          downPaymentRequired: newDownPaymentRequired,
        }),
      };

      await loan.update(updateData);

      // Reload with associations
      await loan.reload({
        include: [
          { association: 'creditScore', required: false }
        ]
      });

      // Log to audit table
      await AuditLogger.log({
        entityType: 'LOAN',
        entityId: loanId,
        action: 'UPDATE_PRINCIPAL',
        data: {
          principalChange: {
            from: oldPrincipal,
            to: newPrincipal,
            difference: Math.abs(difference),
            type: differenceType
          },
          installmentChange: {
            from: oldInstallmentAmount,
            to: newInstallmentAmount
          },
          ...(newDownPaymentRequired !== oldDownPaymentRequired && {
            downPaymentRequiredChange: {
              from: oldDownPaymentRequired,
              to: newDownPaymentRequired,
            },
          }),
          ...(excessDownPayment > 0 && {
            excessDownPaymentCredited: excessDownPayment,
          }),
          loanStatus: loan.status
        },
        actorId: actorId || 1,
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      logger.info(
        `Loan ${loanId} principal updated: ${oldPrincipal} -> ${newPrincipal} (${differenceType} of ${Math.abs(difference)}). ` +
        `Installment recalculated: ${oldInstallmentAmount} -> ${newInstallmentAmount}` +
        (newDownPaymentRequired !== oldDownPaymentRequired
          ? `. Down payment required: ${oldDownPaymentRequired} -> ${newDownPaymentRequired}`
          : '') +
        (excessDownPayment > 0 ? `. Excess DP ${excessDownPayment} credited to balance` : '') +
        ` by user ${actorId}`
      );

      // Emit loan transaction event for principal update
      emitLoanTransaction({
        loanId: loan.id,
        transactionType: LoanTransactionType.PRINCIPAL_UPDATE,
        direction: difference > 0 ? 'DEBIT' : 'CREDIT',
        amount: difference,
        currency: loan.currency,
        principalBalance: Number(newPrincipal),
        interestBalance: 0,
        feesBalance: Number(loan.fees || 0),
        penaltiesBalance: Number(loan.penalties || 0),
        totalBalance: Number(newPrincipal),
        referenceType: 'loan',
        referenceId: loan.id,
        transactionDate: new Date(),
        notes: `Principal ${differenceType}: ${oldPrincipal} → ${newPrincipal}`,
        createdBy: actorId || null,
      });

      return loan;

    } catch (error) {
      logger.error(`Error updating principal amount for loan ${loanId}: ${error.message}`);
      throw error;
    }
  },

  /**
   * Auto-provisions a loan when it transitions to DEFAULTED.
   * Provision amount = sum of overdue / missed installments only.
   * Internal helper — not exposed on the public service API.
   *
   * @param {object} loan       - Loan instance with repaymentSchedules loaded
   * @param {number} [actorId]
   */
  async _autoProvision(loan, actorId) {
    // Skip if a provision already exists — cron job owns recurring provisioning.
    // This guard prevents double-provisioning when an admin manually sets DEFAULTED.
    if (Number(loan.provisionedAmount || 0) > 0) {
      logger.info(`Auto-provision skipped for loan ${loan.id}: provision already exists (${loan.provisionedAmount})`);
      return;
    }

    // Sum only installments that are overdue or missed
    const schedules = await RepaymentSchedule.findAll({
      where: { loanId: loan.id, status: ['overdue', 'partial'] },
    });

    const overdueTotal = schedules.reduce((sum, s) => {
      const owed = Number(s.totalAmount) - Number(s.paidAmount || 0);
      return sum + Math.max(0, owed);
    }, 0);

    if (overdueTotal <= 0) {
      logger.info(`Auto-provision skipped for loan ${loan.id}: no overdue installment balance`);
      return;
    }

    await ledgerService.postProvisionEntry(loan, overdueTotal, actorId);

    const newProvisioned = Number((Number(loan.provisionedAmount || 0) + overdueTotal).toFixed(2));
    await loan.update({ provisionedAmount: newProvisioned });

    emitLoanTransaction({
      loanId: loan.id,
      transactionType: LoanTransactionType.PROVISION,
      direction: 'CREDIT',
      amount: overdueTotal,
      currency: loan.currency,
      principalBalance: Number(loan.outstandingBalance),
      interestBalance: 0,
      feesBalance: 0,
      penaltiesBalance: 0,
      totalBalance: Number(loan.outstandingBalance),
      referenceType: 'loan',
      referenceId: loan.id,
      transactionDate: new Date(),
      notes: `Auto-provision on DEFAULTED — ${schedules.length} overdue installment(s) — Loan ${loan.referenceCode}`,
      createdBy: actorId || null,
    });

    logger.info(`Auto-provisioned ${overdueTotal} for loan ${loan.id} (${loan.referenceCode})`);
  },

  /**
   * Write off a loan (full or partial).
   *
   * Flow:
   *  1. Validate loan status (must be active, overdue, defaulted, or partially_written_off)
   *  2. If writeOffAmount > provisionedAmount, auto-top-up provision (DR 5002 / CR 1300 for gap)
   *  3. Post write-off journal entry (DR 1300 / CR 1100 — no P&L impact)
   *  4. Mark remaining pending/overdue installments → 'written_off'
   *  5. Update loan: outstandingBalance, writtenOffAmount, writtenOffDate, status, provisionedAmount
   *  6. Emit WRITE_OFF loan transaction
   *  7. Audit log
   *
   * @param {number} loanId
   * @param {object} opts
   * @param {number}  opts.writeOffAmount  - Amount to write off (≤ outstandingBalance)
   * @param {string}  opts.reason          - Required write-off reason / notes
   * @param {number}  opts.performedBy     - User ID executing the write-off
   * @param {string}  [opts.userAgent]
   * @returns {Promise<object>} Updated loan
   */
  async writeOffLoan(loanId, { writeOffAmount, reason, performedBy, userAgent = 'unknown' }) {
    const WRITABLE_STATUSES = [
      LoanStatus.ACTIVE,
      LoanStatus.OVERDUE,
      LoanStatus.DEFAULTED,
      LoanStatus.PARTIALLY_PAID,
      LoanStatus.PARTIALLY_WRITTEN_OFF,
    ];

    const t = await sequelize.transaction();
    try {
      const loan = await Loan.findByPk(loanId, {
        include: [{ association: 'repaymentSchedules', required: false }],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!loan) throw Object.assign(new Error('Loan not found'), { statusCode: 404 });

      if (!WRITABLE_STATUSES.includes(loan.status)) {
        throw Object.assign(
          new Error(`Loan cannot be written off. Current status: ${loan.status}. Must be one of: ${WRITABLE_STATUSES.join(', ')}`),
          { statusCode: 400 }
        );
      }

      if (!reason || !String(reason).trim()) {
        throw Object.assign(new Error('A reason is required for a loan write-off'), { statusCode: 400 });
      }

      const outstanding = Number(loan.outstandingBalance);
      const amount = writeOffAmount != null ? Number(writeOffAmount) : outstanding;

      if (Number.isNaN(amount) || amount <= 0) {
        throw Object.assign(new Error('writeOffAmount must be a positive number'), { statusCode: 400 });
      }
      if (amount > outstanding + CURRENCY_EPSILON) {
        throw Object.assign(
          new Error(`writeOffAmount (${amount}) exceeds outstanding balance (${outstanding})`),
          { statusCode: 400 }
        );
      }

      // ── Step 1: Post journal entries (top-up provision if needed + write-off) ──
      await ledgerService.postWriteOffEntry(loan, amount, performedBy, t);

      // ── Step 2: Determine how much of provisionedAmount was consumed ──
      const provisioned = Number(loan.provisionedAmount || 0);
      const gap = Math.max(0, amount - provisioned);
      const newProvisionedAmount = Number(Math.max(0, provisioned + gap - amount).toFixed(2));

      // ── Step 3: Mark remaining open installments as written_off ──
      const isFullWriteOff = Math.abs(amount - outstanding) < CURRENCY_EPSILON;
      if (isFullWriteOff) {
        await RepaymentSchedule.update(
          { status: 'written_off', notes: `Written off: ${reason}` },
          {
            where: { loanId, status: ['pending', 'overdue', 'partial'] },
            transaction: t,
          }
        );
      }
      // For partial write-offs the schedule keeps running as-is (balance is just reduced).

      // ── Step 4: Update loan fields ──
      const newBalance = Number((outstanding - amount).toFixed(2));
      const newWrittenOff = Number(((Number(loan.writtenOffAmount) || 0) + amount).toFixed(2));
      let newStatus;
      if (isFullWriteOff) {
        newStatus = LoanStatus.WRITTEN_OFF;
      } else {
        newStatus = LoanStatus.PARTIALLY_WRITTEN_OFF;
      }

      await loan.update({
        outstandingBalance: newBalance,
        writtenOffAmount: newWrittenOff,
        writtenOffDate: new Date().toISOString().split('T')[0],
        provisionedAmount: newProvisionedAmount,
        status: newStatus,
      }, { transaction: t });

      await t.commit();

      // ── Step 5: Emit loan transaction (outside DB transaction — fire-and-forget) ──
      emitLoanTransaction({
        loanId: loan.id,
        transactionType: LoanTransactionType.WRITE_OFF,
        direction: 'CREDIT',
        amount,
        currency: loan.currency,
        principalBalance: newBalance,
        interestBalance: 0,
        feesBalance: 0,
        penaltiesBalance: 0,
        totalBalance: newBalance,
        referenceType: 'loan',
        referenceId: loan.id,
        transactionDate: new Date(),
        notes: `Write-off (${isFullWriteOff ? 'full' : 'partial'}) — ${reason}`,
        createdBy: performedBy || null,
      });

      // ── Step 6: Audit log ──
      await AuditLogger.log({
        entityType: 'LOAN',
        entityId: loanId,
        action: 'WRITE_OFF',
        data: {
          writeOffAmount: amount,
          previousBalance: outstanding,
          newBalance,
          newStatus,
          reason,
          isFullWriteOff,
        },
        actorId: performedBy || 1,
        options: { actorType: 'USER', source: userAgent },
      });

      logger.info(
        `Loan ${loanId} (${loan.referenceCode}) written off: ${amount} by user ${performedBy}. ` +
        `Balance: ${outstanding} → ${newBalance}. Status: ${newStatus}`
      );

      await loan.reload({
        include: [
          { association: 'repaymentSchedules', required: false },
          { association: 'transactions', required: false },
        ],
      });

      return loan;

    } catch (err) {
      await t.rollback();
      logger.error(`Error in writeOffLoan (${loanId}): ${err.message}`);
      throw err;
    }
  },

};

/**
 * Fetch a client by PK and assert they are eligible for a new loan.
 * Throws a 422 error if KYC is unverified, account is inactive, or client not found.
 * @param {number} clientId
 * @returns {Promise<object>} Client instance
 */
async function fetchAndValidateClient(clientId) {
  const client = await Client.findByPk(clientId);
  if (!client) throw new Error('Client not found');
  if (client.kycStatus !== 'verified') {
    throw Object.assign(new Error('Client KYC is not verified. Loan creation not allowed.'), { statusCode: 422 });
  }
  if (client.status !== 'active') {
    throw Object.assign(new Error(`Client account is not active (current status: ${client.status}). Loan creation not allowed.`), { statusCode: 422 });
  }
  if (!client.isActive) {
    throw Object.assign(new Error('Client account is inactive. Loan creation not allowed.'), { statusCode: 422 });
  }
  return client;
}

/**
 * Validate co-signer rules against the loan product.
 * Throws a 422 error if co-signer is required but missing, or matches the borrower.
 * @param {{ clientId: number, coSignerId?: number }} data
 * @param {{ requiresCoSigner: boolean }} product
 */
function validateCoSigner(data, product) {
  if (product.requiresCoSigner && !data.coSignerId) {
    throw Object.assign(
      new Error('A co-signer is required for the selected loan product.'),
      { statusCode: 422 }
    );
  }
  if (data.coSignerId && String(data.coSignerId) === String(data.clientId)) {
    throw Object.assign(new Error('Co-signer cannot be the same person as the borrower.'), { statusCode: 422 });
  }
}

/**
 * Validate that a client has no conflicting open loans
 * @param {number} clientId 
 * @param {Array<string>} allowedStatuses Optional override
 */
async function validateClientOpenLoans(clientId, allowedStatuses = []) {
  if (!clientId) {
    throw new Error('clientId is required for loan validation');
  }

  // Default statuses considered "open"
  const openStatuses = [
    LoanStatus.APPROVED,
    LoanStatus.DISBURSED,
    LoanStatus.IN_REVIEW,
    LoanStatus.ACTIVE,
    LoanStatus.UNDER_REVIEW,
    LoanStatus.PENDING
  ];

  // Use allowedStatuses if provided, otherwise default to openStatuses
  const statusesToCheck = allowedStatuses.length > 0 ? allowedStatuses : openStatuses;

  const existingLoans = await Loan.findAll({
    where: {
      clientId,
      status: statusesToCheck
    }
  });

  if (existingLoans.length > 0) {
    throw new Error(
      `Client has ${existingLoans.length} existing loan(s) in either of the following statuses: ${statusesToCheck.join(', ')}`
    );
  }

  return true;
}

module.exports = loanService;
