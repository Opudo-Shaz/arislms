const Loan = require('../models/loanModel');
const LoanProduct = require('../models/loanProductModel');
const User = require('../models/userModel');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const { calculateEndDate } = require('../utils/helpers'); 
const LoanStatus = require('../enums/loanStatus');
const AuditLogger = require('../utils/auditLogger');

// Calculates monthly payment
function calculateMonthlyPayment(principal, interestRate, termMonths, interestType = 'reducing') {
  const P = parseFloat(principal);
  const r = parseFloat(interestRate) / 100 / 12;
  const n = parseInt(termMonths, 10);

  if (!P || !n) return null;

  if (!r) return (P / n).toFixed(2);

  if (interestType === 'flat') {
    const totalInterest = P * (parseFloat(interestRate) / 100) * (n / 12);
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
      if (role === 'admin') {
        const loans = await Loan.findAll();
        logger.info(`Retrieved ${loans.length} loans (admin)`);
        return loans;
      }
      const loans = await Loan.findAll({ where: { clientId: userId } });
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
      const loan = await Loan.findByPk(id);
      if (!loan) throw new Error('Loan not found');

      if (role !== 'admin' && loan.clientId !== userId) {
        throw new Error('Access denied: You can only access your own loans');
      }

      return loan;
    } catch (error) {
      logger.error(`Error in getLoanById (${id}): ${error.message}`);
      throw error;
    }
  },

  async createLoan(data, createdByUser, userAgent) {
    try {
      const creatorId = createdByUser?.id || null;
      logger.info(`loanService.createLoan called by user ${creatorId}`);

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
        createdBy: creatorId,

        paymentSchedule: {
          type: interestType,
          termMonths,
          monthlyPayment: installmentAmount
        }
      };

      const newLoan = await Loan.create(loanPayload);

      // Validate the created loan before logging
      if (!newLoan || !newLoan.id) {
        logger.error('Loan creation returned invalid result', { newLoan });
        throw new Error('Loan creation failed: invalid loan object returned');
      }

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

  async updateLoan(id, data, updatorId = null, userAgent = 'unknown') {
    try {
      logger.info(`loanService.updateLoan called for loan ${id}`);
      const loan = await Loan.findByPk(id);
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
        actorId: updatorId || 'system',
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      logger.info(`Loan ${id} updated successfully by user ${updatorId}`);
      return loan;
    } catch (error) {
      logger.error(`Error in updateLoan (${id}): ${error.message}`);
      throw error;
    }
  },

  async deleteLoan(id, deletorId = null, userAgent = 'unknown') {
    try {
      logger.info(`loanService.deleteLoan called for loan ${id}`);
      const loan = await Loan.findByPk(id);
      if (!loan) throw new Error('Loan not found');

      const deletedData = loan.toJSON();
      await loan.destroy();

      // Log deletion to audit table
      await AuditLogger.log({
        entityType: 'LOAN',
        entityId: id,
        action: 'DELETE',
        data: deletedData,
        actorId: deletorId || 'system',
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      logger.warn(`Loan ${id} deleted`);
      return { message: 'Loan deleted successfully', id };
    } catch (error) {
      logger.error(`Error in deleteLoan (${id}): ${error.message}`);
      throw error;
    }
  },

};

module.exports = loanService;
