const { v4: uuidv4 } = require('uuid');
const Payment = require('../models/paymentModel');
const Loan = require('../models/loanModel');
const LoanProduct = require('../models/loanProductModel');
const RepaymentSchedule = require('../models/repaymentScheduleModel');
const sequelize = require('../config/sequalize_db');
const logger = require('../config/logger');
const AuditLogger = require('../utils/auditLogger');

const paymentService = {
  /**
   * Updates repayment schedule installments to reflect a payment made
   * @param {number} loanId - The loan ID
   * @param {number} appliedToPrincipal - Amount applied to principal
   * @param {number} appliedToInterest - Amount applied to interest
   * @param {Date} paymentDate - Date of the payment
   * @param {object} transaction - Sequelize transaction object
   */
  async updateRepaymentSchedule(loanId, appliedToPrincipal, appliedToInterest, paymentDate, transaction) {
    try {
      // Fetch all unpaid/partial installments for this loan, ordered by installment number
      const installments = await RepaymentSchedule.findAll({
        where: {
          loanId,
          status: ['pending', 'partial']
        },
        order: [['installmentNumber', 'ASC']],
        transaction
      });

      if (installments.length === 0) {
        logger.warn(`No pending installments found for loan ${loanId}`);
        return;
      }

      let remainingPrincipal = appliedToPrincipal;
      let remainingInterest = appliedToInterest;

      // Apply payment to installments in order
      for (const element of installments) {
        const installment = element;
        const outstandingPrincipal = Number(installment.principalAmount) - Number(installment.paidAmount || 0);
        const outstandingInterest = Number(installment.interestAmount) - Number(installment.paidAmount || 0);
        const outstandingTotal = outstandingPrincipal + outstandingInterest;

        if (remainingPrincipal + remainingInterest <= 0) {
          break; // No more payment to apply
        }

        // Calculate payment for this installment
        let paymentToThisInstallment = 0;
        let interestForThisInstallment = 0;
        let principalForThisInstallment = 0;

        // Prioritize interest payment first, then principal
        if (remainingInterest > 0) {
          interestForThisInstallment = Math.min(remainingInterest, outstandingInterest);
          remainingInterest -= interestForThisInstallment;
        }

        if (remainingPrincipal > 0) {
          principalForThisInstallment = Math.min(remainingPrincipal, outstandingPrincipal);
          remainingPrincipal -= principalForThisInstallment;
        }

        paymentToThisInstallment = interestForThisInstallment + principalForThisInstallment;
        const newPaidAmount = Number(installment.paidAmount || 0) + paymentToThisInstallment;

        // Determine status based on amount paid
        let newStatus = 'partial';
        if (newPaidAmount >= outstandingTotal) {
          newStatus = 'paid';
        }

        // Check if payment is made after due date
        const isMissed = paymentDate > new Date(installment.dueDate);

        // Update installment
        await installment.update({
          paidAmount: Number(newPaidAmount.toFixed(2)),
          paidDate: newStatus === 'paid' ? paymentDate : installment.paidDate,
          status: newStatus,
          isMissed: isMissed || installment.isMissed // Keep missed flag if already set
        }, { transaction });

        logger.info(`Updated installment ${installment.installmentNumber} for loan ${loanId}: status=${newStatus}, paidAmount=${newPaidAmount}`);
      }

      // Update remaining balance for all installments after the paid ones
      const allInstallments = await RepaymentSchedule.findAll({
        where: { loanId },
        order: [['installmentNumber', 'ASC']],
        transaction
      });

      let cumulativePaid = 0;
      for (const element of allInstallments) {
        const inst = element;
        cumulativePaid += Number(inst.paidAmount || 0);
        const remainingBalance = Math.max(0, Number(inst.remainingBalance) - (appliedToPrincipal + appliedToInterest));
        
        await inst.update({ remainingBalance: Number(remainingBalance.toFixed(2)) }, { transaction });
      }

    } catch (error) {
      logger.error(`Error updating repayment schedule for loan ${loanId}: ${error.message}`);
      throw error;
    }
  },

  async getAllPayments(role, userId) {
  try {
    logger.info(`paymentService.getAllPayments called by user ${userId} (role: ${role})`);

    // Admin roles are 1 and 2
    if ([1, 2].includes(Number(role))) {
      return await Payment.findAll({ include: [{ model: Loan }] });
    }

    // Normal users: fetch only payments for their loans (by clientId)
    return await Payment.findAll({
      include: [{
        model: Loan,
        where: { clientId: userId }
      }]
    });
  } catch (err) {
    logger.error(`Error in getAllPayments: ${err.message}`);
    throw err;
  }
},

async getPaymentsByLoan(loanId) {
  try {
    logger.info(`Fetching payments for loan ${loanId}`);
    return await Payment.findAll({ where: { loanId } });
  } catch (err) {
    logger.error(`Error in getPaymentsByLoan: ${err.message}`);
    throw err;
  }
},

async createPayment(data, user, userAgent = 'unknown') {
  const t = await sequelize.transaction();
  try {
    const creatorId = user?.id || null;
    logger.info(`Creating payment for loan ${data.loanId} by user ${creatorId}`);

    // Fetch loan and associated loan product
    const loan = await Loan.findByPk(data.loanId, { include: [{ model: LoanProduct }] });
    if (!loan) throw new Error('Loan not found');

    // Validate that the clientId in the request matches the loan's clientId
    if (Number(loan.clientId) !== Number(data.clientId)) {
      throw new Error('Client ID does not match loan client');
    }

    const paymentAmount = Number(Number.parseFloat(data.amount));
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) throw new Error('Payment amount must be greater than zero');

    const outstanding = Number(Number.parseFloat(loan.outstandingBalance));
    if (paymentAmount > outstanding) throw new Error('Payment amount exceeds outstanding balance');

    // Determine interest rate from loanProduct (fallback to loan.interestRate)
    const interestSource = loan.LoanProduct || loan.loanProduct || null;
    const interestRate = interestSource ? Number(Number.parseFloat(interestSource.interestRate || loan.interestRate)) : Number(Number.parseFloat(loan.interestRate));
    const monthlyInterest = (outstanding * (interestRate / 100) / 12);

    const appliedToInterestRaw = Math.min(paymentAmount, monthlyInterest);
    const appliedToInterest = Number(appliedToInterestRaw.toFixed(2));
    const appliedToPrincipal = Number((paymentAmount - appliedToInterest).toFixed(2));

    // Create payment record inside transaction
    const payment = await Payment.create({
      loanId: data.loanId,
      amount: paymentAmount,
      currency: data.currency || 'KES',
      paymentMethod: data.paymentMethod || 'cash',
      externalRef: data.externalRef || `TX-${uuidv4().split('-')[0].toUpperCase()}`,
      payerName: data.payerName || null,
      payerPhone: data.payerPhone || null,
      transactionDate: data.transactionDate ? new Date(data.transactionDate) : new Date(),
      paymentDate: new Date(),
      appliedToPrincipal,
      appliedToInterest,
      fees: data.fees || 0,
      penalties: data.penalties || 0,
      processedBy: creatorId,
      notes: data.notes || null,
    }, { transaction: t });

    // Update loan repayment schedule to reflect this payment (mark installments as paid, adjust future due amounts, etc.)
    await this.updateRepaymentSchedule(data.loanId, appliedToPrincipal, appliedToInterest, new Date(), t);
 

    // Update loan outstanding balance, amount repaid, and repayment count
    const currentAmountRepaid = Number(loan.amountRepaid || 0);
    const currentNoOfRepayments = Number(loan.noOfRepayments || 0);
    const newBalanceRaw = outstanding - appliedToPrincipal;
    const newBalance = newBalanceRaw < 0 ? 0 : Number(newBalanceRaw.toFixed(2));
    
    await loan.update({ 
      outstandingBalance: newBalance,
      amountRepaid: Number((currentAmountRepaid + appliedToPrincipal).toFixed(2)),
      noOfRepayments: currentNoOfRepayments + 1
    }, { transaction: t });

    // Log to audit table after successful creation
    await AuditLogger.log({
      entityType: 'PAYMENT',
      entityId: payment.id,
      action: 'CREATE',
      data: {
        loanId: data.loanId,
        amount: paymentAmount,
        appliedToPrincipal,
        appliedToInterest,
        externalRef: payment.externalRef
      },
      actorId: creatorId || 'system',
      options: {
        actorType: 'USER',
        source: userAgent
      }
    });

    await t.commit();

    logger.info(`Payment ${payment.id} recorded for loan ${loan.id}. New balance: ${newBalance}`);
    return payment;
  } catch (err) {
    await t.rollback();
    logger.error(`Error creating payment: ${err.message}`);
    throw err;
  }
},

async deletePayment(id, deletorId = null, userAgent = 'unknown') {
  try {
    logger.warn(`Attempting to delete payment ${id}`);
    const payment = await Payment.findByPk(id);
    if (!payment) throw new Error('Payment not found');

    const deletedData = payment.toJSON();
    await payment.destroy();

    // Log to audit table after successful deletion
    await AuditLogger.log({
      entityType: 'PAYMENT',
      entityId: id,
      action: 'DELETE',
      data: deletedData,
      actorId: deletorId || 'system',
      options: {
        actorType: 'USER',
        source: userAgent
      }
    });

    logger.info(`Payment ${id} deleted by user ${deletorId}`);
    return { message: 'Payment deleted successfully' };
  } catch (err) {
    logger.error(`Error deleting payment ${id}: ${err.message}`);
    throw err;
  }
},
};

module.exports = paymentService;