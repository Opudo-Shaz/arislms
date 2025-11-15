const { v4: uuidv4 } = require('uuid');
const Payment = require('../models/paymentModel');
const Loan = require('../models/loanModel');
const logger = require('../config/logger');

const paymentService = {
  async getAllPayments(role, userId) {
    logger.info(`paymentService.getAllPayments called by ${userId} (${role})`);

    if (role === 'admin') {
      const payments = await Payment.findAll({ include: Loan });
      return payments;
    }

    // For normal users, fetch only payments belonging to their loans
    const payments = await Payment.findAll({
      include: {
        model: Loan,
        where: { clientId: userId }
      }
    });
    return payments;
  },

  async getPaymentsByLoan(loanId) {
    logger.info(`Fetching payments for loan ${loanId}`);
    return await Payment.findAll({ where: { loanId } });
  },

  async createPayment(data, user) {
    logger.info(`Creating payment for loan ${data.loanId} by user ${user.id}`);

    const loan = await Loan.findByPk(data.loanId);
    if (!loan) throw new Error('Loan not found');

    const paymentAmount = parseFloat(data.amount);
    const outstanding = parseFloat(loan.outstandingBalance);

    if (paymentAmount <= 0) throw new Error('Payment amount must be greater than zero');
    if (paymentAmount > outstanding) throw new Error('Payment amount exceeds outstanding balance');

    // Basic allocation: 90% principal, 10% interest (customize later)
    const appliedToInterest = (paymentAmount * 0.1).toFixed(2);
    const appliedToPrincipal = (paymentAmount * 0.9).toFixed(2);

    const payment = await Payment.create({
      loanId: data.loanId,
      amount: paymentAmount,
      currency: data.currency || 'KES',
      paymentMethod: data.paymentMethod || 'cash',
      transactionReference: data.transactionReference || `TX-${uuidv4().split('-')[0].toUpperCase()}`,
      appliedToPrincipal,
      appliedToInterest,
      processedBy: user.id,
      notes: data.notes || null,
    });

    // Update loan outstanding balance
    const newBalance = outstanding - paymentAmount;
    await loan.update({ outstandingBalance: newBalance < 0 ? 0 : newBalance });

    logger.info(`Payment ${payment.id} recorded for loan ${loan.id}. New balance: ${loan.outstandingBalance}`);
    return payment;
  },

  async deletePayment(id) {
    logger.warn(`Attempting to delete payment ${id}`);
    const payment = await Payment.findByPk(id);
    if (!payment) throw new Error('Payment not found');
    await payment.destroy();
    logger.info(`Payment ${id} deleted`);
    return { message: 'Payment deleted successfully' };
  },
};

module.exports = paymentService;
