const { v4: uuidv4 } = require('uuid');
const Payment = require('../models/paymentModel');
const Loan = require('../models/loanModel');
const LoanProduct = require('../models/loanProductModel');
const sequelize = require('../config/sequalize_db');
const logger = require('../config/logger');
const AuditLogger = require('../utils/auditLogger');

const paymentService = {
async getAllPayments(role, userId) {
  try {
    logger.info(`paymentService.getAllPayments called by user ${userId} (${role})`);

    if (role === 'admin') {
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

    const paymentAmount = Number(parseFloat(data.amount));
    if (!isFinite(paymentAmount) || paymentAmount <= 0) throw new Error('Payment amount must be greater than zero');

    const outstanding = Number(parseFloat(loan.outstandingBalance));
    if (paymentAmount > outstanding) throw new Error('Payment amount exceeds outstanding balance');

    // Determine interest rate from loanProduct (fallback to loan.interestRate)
    const interestSource = loan.LoanProduct || loan.loanProduct || null;
    const interestRate = interestSource ? Number(parseFloat(interestSource.interestRate || loan.interestRate)) : Number(parseFloat(loan.interestRate));
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

    // Update loan outstanding balance
    const newBalanceRaw = outstanding - appliedToPrincipal;
    const newBalance = newBalanceRaw < 0 ? 0 : Number(newBalanceRaw.toFixed(2));
    await loan.update({ outstandingBalance: newBalance }, { transaction: t });

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