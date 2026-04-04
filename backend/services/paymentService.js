const { v4: uuidv4 } = require('uuid');
const Payment = require('../models/paymentModel');
const Loan = require('../models/loanModel');
const LoanProduct = require('../models/loanProductModel');
const RepaymentSchedule = require('../models/repaymentScheduleModel');
const sequelize = require('../config/sequalize_db');
const logger = require('../config/logger');
const AuditLogger = require('../utils/auditLogger');
const LoanStatus = require('../enums/loanStatus');

const paymentService = {
  /**
   * Applies a payment to the loan's repayment schedule installments.
   *
   * Allocation strategy per installment (interest-first convention):
   *   1. Cover any outstanding interest on the installment first
   *   2. Cover outstanding principal with the remainder
   *   3. Any excess rolls forward to the next installment
   *
   * Also updates each touched installment's `remainingBalance` to reflect
   * the actual declining principal after payment.
   *
   * @param {number} loanId - The loan ID
   * @param {number} paymentAmount - Total payment amount to apply
   * @param {Date} paymentDate - Date of the payment
   * @param {number} loanOutstanding - Current loan outstanding principal balance
   * @param {object} transaction - Sequelize transaction object
   * @returns {Promise<{appliedToPrincipal: number, appliedToInterest: number, nextDueDate: string|null}>}
   */
  async applyPaymentToSchedule(loanId, paymentAmount, paymentDate, loanOutstanding, transaction) {
    try {
      const installments = await RepaymentSchedule.findAll({
        where: { loanId, status: ['pending', 'partial'] },
        order: [['installmentNumber', 'ASC']],
        transaction
      });

      // No schedule entries — treat entire payment as principal reduction
      if (installments.length === 0) {
        logger.warn(`No pending installments found for loan ${loanId}, applying full amount to principal`);
        return { appliedToPrincipal: paymentAmount, appliedToInterest: 0, nextDueDate: null };
      }

      let remaining = paymentAmount;
      let totalPrincipalApplied = 0;
      let totalInterestApplied = 0;
      let runningBalance = loanOutstanding;

      for (const installment of installments) {
        if (remaining <= 0) break;

        const currentPaid = Number(installment.paidAmount || 0);
        const owed = Number(installment.totalAmount) - currentPaid;
        if (owed <= 0) continue;

        // ── Determine remaining interest & principal on this installment ──
        // Convention: paidAmount covers interest first, then principal.
        //   paidAmount < interestAmount  →  some interest still owed
        //   paidAmount >= interestAmount →  interest fully covered,
        //     excess (paidAmount − interestAmount) applied to principal
        const interestOnInstallment = Number(installment.interestAmount);
        const principalOnInstallment = Number(installment.principalAmount);

        const interestAlreadyCovered = Math.min(currentPaid, interestOnInstallment);
        const principalAlreadyCovered = Math.max(0, currentPaid - interestOnInstallment);

        const interestRemaining = interestOnInstallment - interestAlreadyCovered;
        const principalRemaining = principalOnInstallment - principalAlreadyCovered;

        // ── Allocate this payment: interest first, then principal ─────────
        const payForThis = Math.min(remaining, owed);
        const interestPortion = Math.min(payForThis, interestRemaining);
        const principalPortion = payForThis - interestPortion;

        totalInterestApplied += interestPortion;
        totalPrincipalApplied += principalPortion;
        runningBalance = Math.max(0, runningBalance - principalPortion);

        // ── Update installment record ─────────────────────────────────────
        const newPaidAmount = Number((currentPaid + payForThis).toFixed(2));
        const isFullyPaid = newPaidAmount >= Number(installment.totalAmount) - 0.01;
        const isMissed = paymentDate > new Date(installment.dueDate);

        await installment.update({
          paidAmount: newPaidAmount,
          paidDate: isFullyPaid ? paymentDate : installment.paidDate,
          status: isFullyPaid ? 'paid' : 'partial',
          isMissed: isMissed || installment.isMissed,
          remainingBalance: Number(runningBalance.toFixed(2))
        }, { transaction });

        logger.info(
          `Installment #${installment.installmentNumber} loan ${loanId}: ` +
          `paid=${newPaidAmount}/${installment.totalAmount} status=${isFullyPaid ? 'paid' : 'partial'} ` +
          `(interest=${interestPortion.toFixed(2)}, principal=${principalPortion.toFixed(2)})`
        );

        remaining -= payForThis;
      }

      // Determine nextPaymentDate from the first still-unpaid installment
      const nextUnpaid = await RepaymentSchedule.findOne({
        where: { loanId, status: ['pending', 'partial'] },
        order: [['installmentNumber', 'ASC']],
        transaction
      });

      return {
        appliedToPrincipal: Number(totalPrincipalApplied.toFixed(2)),
        appliedToInterest: Number(totalInterestApplied.toFixed(2)),
        nextDueDate: nextUnpaid ? nextUnpaid.dueDate : null
      };

    } catch (error) {
      logger.error(`Error applying payment to schedule for loan ${loanId}: ${error.message}`);
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

/**
 * Creates a payment for a loan and updates all related records.
 *
 * Flow:
 *   1. Validate: loan exists, is in a payable state, client matches, amount valid
 *   2. Validate amount against total remaining on schedule (principal + interest)
 *   3. Apply payment to repayment schedule → returns actual principal/interest split
 *   4. Create payment record with the schedule-derived split
 *   5. Update loan summary: outstandingBalance (−principal), amountRepaid (+total),
 *      noOfRepayments, nextPaymentDate, and status (ACTIVE / CLOSED)
 *   6. Audit log the payment
 *
 * @param {Object} data - Payment data { loanId, clientId, amount, currency, paymentMethod, ... }
 * @param {Object} user - Authenticated user making the payment
 * @param {string} userAgent - Source of the action for audit logging
 * @returns {Promise<Object>} Created payment record
 */
async createPayment(data, user, userAgent = 'unknown') {
  const t = await sequelize.transaction();
  try {
    const creatorId = user?.id || null;
    logger.info(`Creating payment for loan ${data.loanId} by user ${creatorId}`);

    // ── Step 1: Validate loan and payment ─────────────────────────────
    const loan = await Loan.findByPk(data.loanId, {
      include: [{ model: LoanProduct }],
      transaction: t
    });
    if (!loan) throw new Error('Loan not found');

    // Ensure loan is in a payable state
    const payableStatuses = [
      LoanStatus.DISBURSED,
      LoanStatus.ACTIVE,
      LoanStatus.PARTIALLY_PAID,
      LoanStatus.OVERDUE
    ];
    if (!payableStatuses.includes(loan.status)) {
      throw new Error(`Loan is not in a payable state. Current status: ${loan.status}`);
    }

    // Validate client ownership
    if (Number(loan.clientId) !== Number(data.clientId)) {
      throw new Error('Client ID does not match loan client');
    }

    const paymentAmount = Number(parseFloat(data.amount));
    if (!isFinite(paymentAmount) || paymentAmount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    // ── Step 2: Validate amount against schedule ──────────────────────
    // Use total remaining on schedule (principal + interest) instead of
    // outstandingBalance alone, so the final payment covering remaining
    // interest is not rejected.
    const pendingInstallments = await RepaymentSchedule.findAll({
      where: { loanId: data.loanId, status: ['pending', 'partial'] },
      transaction: t
    });
    const totalOwed = pendingInstallments.reduce((sum, inst) => {
      return sum + Number(inst.totalAmount) - Number(inst.paidAmount || 0);
    }, 0);

    if (paymentAmount > Number(totalOwed.toFixed(2)) + 0.01) {
      throw new Error(
        `Payment amount (${paymentAmount}) exceeds total amount owed (${totalOwed.toFixed(2)})`
      );
    }

    const outstanding = Number(parseFloat(loan.outstandingBalance));

    // ── Step 3: Apply payment to repayment schedule ───────────────────
    // The schedule determines the actual principal/interest split based on
    // each installment's amortized amounts (interest-first per installment).
    const { appliedToPrincipal, appliedToInterest, nextDueDate } =
      await this.applyPaymentToSchedule(
        data.loanId, paymentAmount, new Date(), outstanding, t
      );

    // ── Step 4: Create payment record ─────────────────────────────────
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

    // ── Step 5: Update loan summary fields ────────────────────────────
    // outstandingBalance tracks remaining principal only
    const newBalance = Math.max(0, Number((outstanding - appliedToPrincipal).toFixed(2)));
    const currentAmountRepaid = Number(loan.amountRepaid || 0);

    const loanUpdates = {
      outstandingBalance: newBalance,
      // amountRepaid tracks total cash received (principal + interest)
      amountRepaid: Number((currentAmountRepaid + paymentAmount).toFixed(2)),
      noOfRepayments: Number(loan.noOfRepayments || 0) + 1,
      nextPaymentDate: nextDueDate || null,
    };

    // Transition loan status based on remaining balance
    if (newBalance <= 0) {
      loanUpdates.status = LoanStatus.CLOSED;
    } else if (loan.status === LoanStatus.DISBURSED) {
      loanUpdates.status = LoanStatus.ACTIVE;
    }

    await loan.update(loanUpdates, { transaction: t });

    // ── Step 6: Audit log ─────────────────────────────────────────────
    await AuditLogger.log({
      entityType: 'PAYMENT',
      entityId: payment.id,
      action: 'CREATE',
      data: {
        loanId: data.loanId,
        amount: paymentAmount,
        appliedToPrincipal,
        appliedToInterest,
        newBalance,
        externalRef: payment.externalRef
      },
      actorId: creatorId || 'system',
      options: {
        actorType: 'USER',
        source: userAgent
      }
    });

    await t.commit();

    logger.info(
      `Payment ${payment.id} recorded for loan ${loan.id}: ` +
      `amount=${paymentAmount} (principal=${appliedToPrincipal}, interest=${appliedToInterest}). ` +
      `New balance: ${newBalance}` +
      (loanUpdates.status ? `, status→${loanUpdates.status}` : '')
    );

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