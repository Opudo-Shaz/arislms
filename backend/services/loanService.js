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
const { calculateEndDate,isAdmin } = require('../utils/helpers'); 
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
 * Builds repayment-schedule DB rows from amortization data, prepending an
 * upfront fee installment when the loan carries fees.
 *
 * Fees are collected at disbursement (net disbursement), so the fee row is
 * recorded as already paid (installment 0) and does not affect the principal +
 * interest installments the borrower still owes.
 *
 * @param {Object} loan - Loan instance (provides id, fees, principalAmount)
 * @param {Array} scheduleData - Output of generateAmortizationSchedule
 * @param {Date|string} disbursementDate - Date fees were collected
 * @returns {Array} Rows ready for RepaymentSchedule.bulkCreate
 */
function buildScheduleEntries(loan, scheduleData, disbursementDate) {
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

  const fees = Number(loan.fees || 0);
  if (fees > 0) {
    const feeDate = new Date(disbursementDate).toISOString().split('T')[0];
    entries.unshift({
      loanId: loan.id,
      installmentNumber: 0,
      dueDate: feeDate,
      principalAmount: 0,
      interestAmount: 0,
      feesAmount: fees,
      totalAmount: fees,
      paidAmount: fees,
      paidDate: feeDate,
      status: 'paid',
      remainingBalance: Number(loan.principalAmount),
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

  async createLoanWithoutCreditScoring(data, createdByUser, userAgent) {
    try {
      const creatorId = createdByUser?.id || null;
      const role = Number(createdByUser?.role_id ?? createdByUser?.role);
      if(!isAdmin(role)) {
        throw new Error('User not authorized to create loans');
      }
      logger.info(`loanService.createLoan called by user ${creatorId}`);

      // Check if client has any conflicting open loans before allowing creation of new loan application
      if (!data.clientId) throw new Error('clientId is required');
      await validateClientOpenLoans(data.clientId);

      if (!data.loanProductId) throw new Error('loanProductId is required');

      // Load loan product
      const product = await LoanProduct.findByPk(data.loanProductId);
      if (!product) throw new Error('Invalid loan product selected');
      collateralService.validateCollateralInputAgainstProduct(product, data.collateral);

      // Apply product rules
      const interestRate = product.interestRate;
      const interestType = product.interestType;
      const termMonths = product.repaymentPeriodMonths;
      const loanCurrency = product.currency || 'KES';
      const fees = product.fees || 0;

    
      //check if client exist and KYC status before creating loan
      const client = await Client.findByPk(data.clientId);
      if (!client) {
        throw new Error('Client not found');
      }
      if (client.kycStatus !== 'verified') {
        throw Object.assign(new Error('Client KYC is not verified. Loan creation not allowed.'), { statusCode: 422 });
      }
      if (client.status !== 'active') {
        throw Object.assign(new Error(`Client account is not active (current status: ${client.status}). Loan creation not allowed.`), { statusCode: 422 });
      }
      if (!client.isActive) {
        throw Object.assign(new Error('Client account is inactive. Loan creation not allowed.'), { statusCode: 422 });
      }
      // Validate co-signer if required by the product or if provided
      if (product.requiresCoSigner && !data.coSignerId && !data.coSignerIdNumber) {
        throw Object.assign(
          new Error('A co-signer is required for the selected loan product. Provide the co-signer\'s ID document number.'),
          { statusCode: 422 }
        );
      }
      if (data.coSignerIdNumber && !data.coSignerId) {
        const coSignerByIdNo = await Client.findOne({ where: { idDocumentNumber: data.coSignerIdNumber } });
        if (!coSignerByIdNo) {
          throw Object.assign(
            new Error(`Co-signer not found. No client with ID document number "${data.coSignerIdNumber}" exists.`),
            { statusCode: 422 }
          );
        }
        if (String(coSignerByIdNo.id) === String(data.clientId)) {
          throw Object.assign(new Error('Co-signer cannot be the same person as the borrower.'), { statusCode: 422 });
        }
        data.coSignerId = coSignerByIdNo.id;
      }
      if (data.coSignerId) {
        const coSigner = await Client.findByPk(data.coSignerId);
        if (!coSigner) throw Object.assign(new Error('Co-signer not found. The provided co-signer ID does not match any client.'), { statusCode: 422 });
        if (String(data.coSignerId) === String(data.clientId)) {
          throw Object.assign(new Error('Co-signer cannot be the same person as the borrower.'), { statusCode: 422 });
        }
      }

      // Calculate derived values
      const endDate = calculateEndDate(data.startDate, termMonths);
      const installmentAmount = calculateMonthlyPayment(
        data.principalAmount,
        interestRate,
        termMonths,
        interestType
      );

      // Build loan payload explicitly
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

        collateral: data.collateral,
        coSignerId: data.coSignerId,
        notes: data.notes,

        status: LoanStatus.PENDING,

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
          { association: 'creditScore', required: false },
          { association: 'collaterals', required: false }
        ]
      });

      // Log to audit table after successful creation
      await AuditLogger.log({
        entityType: 'LOAN',
        entityId: newLoan.id,
        action: 'CREATE',
        data: loanPayload,
        actorId: creatorId,
        options: {
          actorType: 'USER',
          source: userAgent || 'unknown'
        }
      });

      logger.info(
        `Loan created: id=${newLoan.id} reference=${newLoan.referenceCode} by user ${creatorId}`
      );

      return newLoan;

    } catch (error) {
      logger.error(`Error in createLoan: ${error.message}`);
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
      logger.info(`loanService.createLoanWithCreditScoring called by user ${creatorId}`);

      if (!data.clientId) throw new Error('clientId is required');
      if (!data.loanProductId) throw new Error('loanProductId is required');
      if (!data.principalAmount) throw new Error('principalAmount is required');
      if (!data.startDate) throw new Error('startDate is required');

      // 1. Validate client has no conflicting open loans
      await validateClientOpenLoans(data.clientId);

      // 2. Load client data
      const client = await Client.findByPk(data.clientId);
      if (!client) throw new Error('Client not found');

      // 2a. Validate client eligibility
      if (client.kycStatus !== 'verified') {
        throw Object.assign(new Error('Client KYC is not verified. Loan creation not allowed.'), { statusCode: 422 });
      }
      if (client.status !== 'active') {
        throw Object.assign(new Error(`Client account is not active (current status: ${client.status}). Loan creation not allowed.`), { statusCode: 422 });
      }
      if (!client.isActive) {
        throw Object.assign(new Error('Client account is inactive. Loan creation not allowed.'), { statusCode: 422 });
      }

      // 3. Score client via shared service (also loads loans internally)
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

      // 4. Reject if requested principal exceeds computed credit limit
      if (Number(data.principalAmount) > creditLimit) {
        throw Object.assign(
          new Error(`Requested amount (${data.principalAmount}) exceeds client credit limit (${creditLimit})`),
          { statusCode: 422 }
        );
      }

      // 5. Determine loan status based on policy decision
      // APPROVED -> under_review (admin will approve)
      // MANUAL_REVIEW/REJECTED -> pending (needs review)
      let loanStatus;
      if (riskDecision === 'APPROVED') {
        loanStatus = LoanStatus.UNDER_REVIEW;
        logger.info(`Loan application passed automatic checks - setting status to under_review for admin approval`);
      } else {
        loanStatus = LoanStatus.PENDING;
        logger.info(`Loan application did not pass automatic checks - setting status to pending for manual review`);
      }

      // 6. Load loan product
      const product = await LoanProduct.findByPk(data.loanProductId);
      if (!product) throw new Error('Invalid loan product selected');
      collateralService.validateCollateralInputAgainstProduct(product, data.collateral);

      // Apply product rules
      const interestRate = product.interestRate;
      const interestType = product.interestType;
      const termMonths = data.termMonths || product.repaymentPeriodMonths;
      const loanCurrency = product.currency || 'KES';
      const fees = product.fees || 0;

      // Validate co-signer if required by the product or if provided
      if (product.requiresCoSigner && !data.coSignerId && !data.coSignerIdNumber) {
        throw Object.assign(
          new Error('A co-signer is required for the selected loan product. Provide the co-signer\'s ID document number.'),
          { statusCode: 422 }
        );
      }
      if (data.coSignerIdNumber && !data.coSignerId) {
        const coSignerByIdNo = await Client.findOne({ where: { idDocumentNumber: data.coSignerIdNumber } });
        if (!coSignerByIdNo) {
          throw Object.assign(
            new Error(`Co-signer not found. No client with ID document number "${data.coSignerIdNumber}" exists.`),
            { statusCode: 422 }
          );
        }
        if (String(coSignerByIdNo.id) === String(data.clientId)) {
          throw Object.assign(new Error('Co-signer cannot be the same person as the borrower.'), { statusCode: 422 });
        }
        data.coSignerId = coSignerByIdNo.id;
      }
      if (data.coSignerId) {
        const coSigner = await Client.findByPk(data.coSignerId);
        if (!coSigner) throw Object.assign(new Error('Co-signer not found. The provided co-signer ID does not match any client.'), { statusCode: 422 });
        if (String(data.coSignerId) === String(data.clientId)) {
          throw Object.assign(new Error('Co-signer cannot be the same person as the borrower.'), { statusCode: 422 });
        }
      }

      // Calculate derived values
      const endDate = calculateEndDate(data.startDate, termMonths);
      const installmentAmount = calculateMonthlyPayment(
        data.principalAmount,
        interestRate,
        termMonths,
        interestType
      );

      // 7. Create loan with risk assessment data
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

        collateral: data.collateral,
        coSignerId: data.coSignerId,
        notes: data.notes,

        // Status based on policy decision
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

        await transaction.commit();
      } catch (txError) {
        await transaction.rollback();
        throw txError;
      }

      // Validate the created loan
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

      // Log to audit table
      await AuditLogger.log({
        entityType: 'LOAN',
        entityId: newLoan.id,
        action: 'CREATE',
        data: {
          loanPayload,
          scoringResult: { riskScore, riskGrade, riskDti, creditLimit, policyDecision: riskDecision }
        },
        actorId: creatorId,
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      logger.info(
        `Loan created with credit scoring: id=${newLoan.id} reference=${newLoan.referenceCode} ` +
        `riskScore=${riskScore} riskGrade=${riskGrade} decision=${riskDecision} by user ${creatorId}`
      );

      return newLoan;

    } catch (error) {
      logger.error(`Error in createLoanWithCreditScoring: ${error.message}`);
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

  async deleteLoan(id, deletorId = null, userAgent = 'unknown') {
    try {
      logger.info(`loanService.deleteLoan called for loan ${id}`);
      const loan = await Loan.findByPk(id, {
        include: [
          { association: 'repaymentSchedules', required: false },
          { association: 'creditScore', required: false },
          { association: 'collaterals', required: false }
        ]
      });
      if (!loan) throw new Error('Loan not found');

      // Store original data for audit trail
      const originalData = loan.toJSON();
      const previousStatus = loan.status;

      // Soft delete: change status to 'deleted' instead of destroying record
      await loan.update({
        status: LoanStatus.DELETED
      });

      // Reload with associations after update
      await loan.reload({
        include: [
          { association: 'repaymentSchedules', required: false },
          { association: 'creditScore', required: false },
          { association: 'collaterals', required: false }
        ]
      });

      await collateralService.syncCollateralLifecycleForLoanStatus(loan, LoanStatus.DELETED, deletorId, {
        notes: `Loan ${loan.referenceCode} deleted`
      });

      // Log deletion to audit table for compliance and audit trail
      await AuditLogger.log({
        entityType: 'LOAN',
        entityId: id,
        action: 'DELETE',
        data: {
          previousStatus,
          newStatus: LoanStatus.DELETED,
          originalData
        },
        actorId: deletorId || 1,
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      logger.warn(`Loan ${id} marked as deleted (soft delete). Previous status: ${previousStatus}`);
      return { message: 'Loan marked as deleted successfully', id, status: LoanStatus.DELETED };
    } catch (error) {
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

      // Generate repayment schedule
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

      // Post ledger entry for disbursement
      await ledgerService.postDisbursementEntry(loan);

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
      const updatableStatuses = [LoanStatus.PENDING, LoanStatus.IN_REVIEW, LoanStatus.UNDER_REVIEW];
      if (!updatableStatuses.includes(loan.status)) {
        throw new Error(
          `Cannot update principal amount for loan in '${loan.status}' status. ` +
          `Only allowed for loans in PENDING, IN_REVIEW, or UNDER_REVIEW status`
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
        const minAmount = loan.loanProduct.minLoanAmount ? Number.parseFloat(loan.loanProduct.minLoanAmount) : null;
        const maxAmount = loan.loanProduct.maxLoanAmount ? Number.parseFloat(loan.loanProduct.maxLoanAmount) : null;

        if (minAmount && newPrincipal < minAmount) {
          throw new Error(
            `Principal amount ${newPrincipal} is below minimum allowed for this product (${minAmount})`
          );
        }

        if (maxAmount && newPrincipal > maxAmount) {
          throw new Error(
            `Principal amount ${newPrincipal} exceeds maximum allowed for this product (${maxAmount})`
          );
        }
      }

      // Store old values for audit
      const oldPrincipal = loan.principalAmount;
      const oldInstallmentAmount = loan.installmentAmount;
      const difference = newPrincipal - oldPrincipal;
      const differenceType = difference > 0 ? 'top-up' : 'reduction';

      // Recalculate monthly installment with new principal
      const newInstallmentAmount = calculateMonthlyPayment(
        newPrincipal,
        loan.interestRate,
        loan.termMonths,
        loan.interestType
      );

      // Update loan with new principal and calculated installment
      const updateData = {
        principalAmount: newPrincipal,
        outstandingBalance: newPrincipal,
        installmentAmount: newInstallmentAmount
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
        `Installment recalculated: ${oldInstallmentAmount} -> ${newInstallmentAmount} by user ${actorId}`
      );

      // Emit loan transaction event for principal update
      emitLoanTransaction({
        loanId: loan.id,
        transactionType: LoanTransactionType.PRINCIPAL_UPDATE,
        direction: difference > 0 ? 'DEBIT' : 'CREDIT',
        amount: Math.abs(difference),
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
      if (amount > outstanding + 0.005) {
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
      const isFullWriteOff = Math.abs(amount - outstanding) < 0.005;
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
