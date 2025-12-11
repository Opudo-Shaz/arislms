const Loan = require('../models/loanModel');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const LoanProduct = require('../models/loanProductModel');


function calculateMonthlyPayment(principal, interestRate, termMonths, interestType = 'reducing') {
  const P = parseFloat(principal);
  const r = parseFloat(interestRate) / 100 / 12;
  const n = parseInt(termMonths, 10);

  if (!P || !n) return null;
  // if interestRate is 0 or NaN, treat as zero-interest
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
      if (!loan) {
        logger.warn(`Loan ${id} not found`);
        throw new Error('Loan not found');
      }

      if (role !== 'admin' && loan.clientId !== userId) {
        logger.warn(`Access denied: user ${userId} attempted to access loan ${id}`);
        throw new Error('Access denied: You can only access your own loans');
      }

      logger.info(`Loan ${id} retrieved by user ${userId}`);
      return loan;
    } catch (error) {
      logger.error(`Error in getLoanById (${id}): ${error.message}`);
      throw error;
    }
  },

  async createLoan(data, createdByUser) {
  try {
    const creatorId = createdByUser?.id || null;
    logger.info(`loanService.createLoan called by user ${creatorId}`);

    if (!data.loanProductId) {
      throw new Error("loanProductId is required");
    }

    // Load loan product
    const product = await LoanProduct.findByPk(data.loanProductId);
    if (!product) {
      throw new Error("Invalid loan product selected");
    }

    // Apply product rules
   const interestRate = product.interestRate;
   const interestType = product.interestType; 
   const termMonths = product.repaymentPeriodMonths; 
   const penalties = product.penaltyRate || 0; 
   const fees = product.fees || 0;

    // Override loan fields with product values
    data.interestRate = interestRate;
    data.interestType = interestType;
    data.termMonths = termMonths;
    data.penalties = penalties;
    data.fees = fees;

    // Auto-generate reference code
    data.referenceCode = `LN-${uuidv4().split('-')[0].toUpperCase()}`;
    data.createdBy = creatorId;
    data.clientId = data.clientId || creatorId;

    // Monthly installment calculation
    data.installmentAmount = calculateMonthlyPayment(
      data.principalAmount,
      interestRate,
      termMonths,
      interestType
    );

    // Initial outstanding balance
    data.outstandingBalance = data.principalAmount;

    // Auto-generate payment schedule 
    data.paymentSchedule = {
      type: interestType,
      termMonths: termMonths,
      monthlyPayment: data.installmentAmount,
    };

    const newLoan = await Loan.create(data);

    logger.info(`Loan created: id=${newLoan.id} reference=${newLoan.referenceCode} by user ${creatorId}`);
    return newLoan;

  } catch (error) {
    logger.error(`Error in createLoan: ${error.message}`);
    throw error;
  }
},

  async updateLoan(id, data) {
    try {
      logger.info(`loanService.updateLoan called for loan ${id}`);
      const loan = await Loan.findByPk(id);
      if (!loan) {
        logger.warn(`Loan ${id} not found for update`);
        throw new Error('Loan not found');
      }

      // Recalculate if key fields changed
      if (data.principalAmount || data.interestRate || data.termMonths || data.interestType) {
        const principal = data.principalAmount || loan.principalAmount;
        const rate = data.interestRate || loan.interestRate;
        const term = data.termMonths || loan.termMonths;
        const type = data.interestType || loan.interestType;

        data.installmentAmount = calculateMonthlyPayment(principal, rate, term, type);
        // Optionally update paymentSchedule as well
        data.paymentSchedule = {
          type,
          termMonths: term,
          monthlyPayment: data.installmentAmount,
        };
      }

      await loan.update(data);
      logger.info(`Loan ${id} updated successfully`);
      return loan;
    } catch (error) {
      logger.error(`Error in updateLoan (${id}): ${error.message}`);
      throw error;
    }
  },

  async deleteLoan(id) {
    try {
      logger.info(`loanService.deleteLoan called for loan ${id}`);
      const loan = await Loan.findByPk(id);
      if (!loan) {
        logger.warn(`Loan ${id} not found for deletion`);
        throw new Error('Loan not found');
      }
      await loan.destroy();
      logger.warn(`Loan ${id} deleted`);
      return { message: 'Loan deleted successfully', id };
    } catch (error) {
      logger.error(`Error in deleteLoan (${id}): ${error.message}`);
      throw error;
    }
  },
};

module.exports = loanService;
