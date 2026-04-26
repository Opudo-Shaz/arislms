const Loan = require('../models/loanModel');
const LoanProduct = require('../models/loanProductModel');
const User = require('../models/userModel');
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
const { emitLoanTransaction } = require('../utils/loanTransactionEmitter');
const LoanTransactionType = require('../enums/loanTransactionType');

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

const loanService = {

  // Admin: get all loans, User: get own loans
  async getAllLoans(role, userId) {
    try {
      logger.info(`loanService.getAllLoans called by user ${userId} with role ${role}`);
      if (isAdmin(role)) {
        const loans = await Loan.findAll({
          include: [
            { association: 'repaymentSchedules', required: false },
            { association: 'creditScore', required: false },
            { association: 'transactions', required: false }
          ]
        });
        logger.info(`Retrieved ${loans.length} loans (admin)`);
        return loans;
      }
      const loans = await Loan.findAll({ 
        where: { clientId: userId },
        include: [
          { association: 'repaymentSchedules', required: false },
          { association: 'creditScore', required: false },
          { association: 'transactions', required: false }
        ]
      });
      logger.info(`Retrieved ${loans.length} loans for user ${userId}`);
      return loans;
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
          { association: 'transactions', required: false }
        ]
      });
      if (!loan) return null;

      if (!isAdmin(role) && loan.clientId !== userId) {
        return 403; // Access denied
      }

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
      // Validate co-signer exists if provided
      if (data.coSignerId) {
        const coSigner = await User.findByPk(data.coSignerId);
        if (!coSigner) throw new Error('Co-signer user not found');
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
        penalties: 0.00,

        collateral: data.collateral,
        coSignerId: data.coSignerId,
        notes: data.notes,

        status: LoanStatus.PENDING,

        referenceCode: `LN-${uuidv4().split('-')[0].toUpperCase()}`,
        createdBy: creatorId
      };

     const newLoan = await Loan.create(loanPayload);

      // Validate the created loan before logging
      if (!newLoan?.id) {
        logger.error('Loan creation returned invalid result', { newLoan });
        throw new Error('Loan creation failed: invalid loan object returned');
      }

      // Reload loan with associations
      await newLoan.reload({
        include: [{ association: 'creditScore', required: false }]
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

      // Apply product rules
      const interestRate = product.interestRate;
      const interestType = product.interestType;
      const termMonths = data.termMonths || product.repaymentPeriodMonths;
      const loanCurrency = product.currency || 'KES';
      const fees = product.fees || 0;

      // Validate co-signer exists if provided
      if (data.coSignerId) {
        const coSigner = await User.findByPk(data.coSignerId);
        if (!coSigner) throw new Error('Co-signer user not found');
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
        penalties: 0.00,

        collateral: data.collateral,
        coSignerId: data.coSignerId,
        notes: data.notes,

        // Status based on policy decision
        status: loanStatus,

        referenceCode: `LN-${uuidv4().split('-')[0].toUpperCase()}`,
        createdBy: creatorId
      };

      const newLoan = await Loan.create(loanPayload);

      // Validate the created loan
      if (!newLoan?.id) {
        logger.error('Loan creation returned invalid result', { newLoan });
        throw new Error('Loan creation failed: invalid loan object returned');
      }

      // 8. Link the already-created CreditScore record to this loan
      const latestScore = await CreditScore.findOne({
        where: { clientId: data.clientId },
        order: [['created_at', 'DESC']]
      });
      if (latestScore) {
        await latestScore.update({
          loanId: newLoan.id,
          notes: `Auto-scored for loan ${newLoan.referenceCode}`
        });
      }

      // Reload loan with associations
      await newLoan.reload({
        include: [
          { association: 'repaymentSchedules', required: false },
          { association: 'creditScore', required: false }
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
          { association: 'transactions', required: false }
        ]
      });

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
          { association: 'creditScore', required: false }
        ]
      });
      if (!loan) throw new Error('Loan not found');

      // Validate loan can be approved
      if (loan.status !== LoanStatus.PENDING && loan.status !== LoanStatus.IN_REVIEW && loan.status !== LoanStatus.UNDER_REVIEW) {
        throw new Error(`Loan cannot be approved. Current status: ${loan.status}. Loan must be pending, in_review, or under_review.`);
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
          { association: 'transactions', required: false }
        ]
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

  async deleteLoan(id, deletorId = null, userAgent = 'unknown') {
    try {
      logger.info(`loanService.deleteLoan called for loan ${id}`);
      const loan = await Loan.findByPk(id, {
        include: [
          { association: 'repaymentSchedules', required: false },
          { association: 'creditScore', required: false }
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
          { association: 'creditScore', required: false }
        ]
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
          { association: 'creditScore', required: false }
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
      const scheduleEntries = scheduleData.map(entry => ({
        loanId: loan.id,
        installmentNumber: entry.installmentNumber,
        dueDate: entry.dueDate,
        principalAmount: entry.principalAmount,
        interestAmount: entry.interestAmount,
        totalAmount: entry.totalAmount,
        paidAmount: 0,
        status: 'pending',
        remainingBalance: entry.remainingBalance
      }));

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
      const scheduleEntries = scheduleData.map(entry => ({
        loanId: loan.id,
        installmentNumber: entry.installmentNumber,
        dueDate: entry.dueDate,
        principalAmount: entry.principalAmount,
        interestAmount: entry.interestAmount,
        totalAmount: entry.totalAmount,
        paidAmount: 0,
        status: 'pending',
        remainingBalance: entry.remainingBalance
      }));

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
      const scheduleEntries = scheduleData.map(entry => ({
        loanId: loan.id,
        installmentNumber: entry.installmentNumber,
        dueDate: entry.dueDate,
        principalAmount: entry.principalAmount,
        interestAmount: entry.interestAmount,
        totalAmount: entry.totalAmount,
        paidAmount: 0,
        status: 'pending',
        remainingBalance: entry.remainingBalance
      }));

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
      `Client has ${existingLoans.length} existing loan(s) in status: ${statusesToCheck.join(', ')}`
    );
  }

  return true;
}

module.exports = loanService;
