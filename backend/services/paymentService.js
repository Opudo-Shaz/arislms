const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const Payment = require('../models/paymentModel');
const Loan = require('../models/loanModel');
const LoanProduct = require('../models/loanProductModel');
const RepaymentSchedule = require('../models/repaymentScheduleModel');
const User = require('../models/userModel');
const sequelize = require('../config/sequalize_db');
const logger = require('../config/logger');
const AuditLogger = require('../utils/auditLogger');
const LoanStatus = require('../enums/loanStatus');
const ledgerService = require('./ledgerService');
const memberContributionService = require('./memberContributionService');
const { emitLoanTransaction } = require('../utils/loanTransactionEmitter');
const LoanTransactionType = require('../enums/loanTransactionType');
const systemConfigService = require('./systemConfigService');
const { CURRENCY_EPSILON } = require('../utils/helpers');

const paymentService = {
  /**
   * Applies a payment to the loan's repayment schedule installments.
   *
   * Allocation strategy per installment (penalty-first convention):
   *   1. Cover any outstanding penalty on the installment first
   *   2. Cover outstanding interest with the remainder
   *   3. Cover outstanding principal with the remainder
   *   4. Any excess rolls forward to the next installment
   *
   * Also updates each touched installment's `remainingBalance` to reflect
   * the actual declining principal after payment.
   *
   * @param {number} loanId - The loan ID
   * @param {number} paymentAmount - Total payment amount to apply
   * @param {Date} paymentDate - Date of the payment
   * @param {number} loanOutstanding - Current loan outstanding principal balance
   * @param {object} transaction - Sequelize transaction object
   * @returns {Promise<{appliedToPrincipal: number, appliedToInterest: number, appliedToPenalty: number, nextDueDate: string|null}>}
   */
  async applyPaymentToSchedule(loanId, paymentAmount, paymentDate, loanOutstanding, transaction) {
    try {
      const installments = await RepaymentSchedule.findAll({
        where: { loanId, status: ['pending', 'partial', 'overdue'] },
        order: [['installmentNumber', 'ASC']],
        transaction
      });

      // No schedule entries — treat entire payment as principal reduction
      if (installments.length === 0) {
        logger.warn(`No pending installments found for loan ${loanId}, applying full amount to principal`);
        return { appliedToPrincipal: paymentAmount, appliedToInterest: 0, appliedToPenalty: 0, nextDueDate: null };
      }

      let remaining = paymentAmount;
      let totalPrincipalApplied = 0;
      let totalInterestApplied = 0;
      let totalPenaltyApplied = 0;
      let runningBalance = loanOutstanding;

      for (const installment of installments) {
        if (remaining <= 0) break;

        const currentPaid = Number(installment.paidAmount || 0);
        const penaltyOwed = Math.max(0, Number(installment.penaltyAmount || 0) - Number(installment.penaltyPaid || 0));
        const interestOnInstallment = Number(installment.interestAmount);
        const principalOnInstallment = Number(installment.principalAmount);

        // Determine already-covered interest & principal
        // paidAmount convention: penalty first, then interest, then principal
        const paidAfterPenalty = Math.max(0, currentPaid - penaltyOwed);
        const interestAlreadyCovered = Math.min(paidAfterPenalty, interestOnInstallment);
        const principalAlreadyCovered = Math.max(0, paidAfterPenalty - interestOnInstallment);

        const interestRemaining = interestOnInstallment - interestAlreadyCovered;
        const principalRemaining = principalOnInstallment - principalAlreadyCovered;

        // Total owed on this installment including outstanding penalty
        const installmentOwed = penaltyOwed + interestRemaining + principalRemaining;
        if (installmentOwed <= 0) continue;

        // ── Allocate: penalty first, then interest, then principal ───────────
        const payForThis = Math.min(remaining, installmentOwed);

        const penaltyPortion = Math.min(payForThis, penaltyOwed);
        const afterPenalty = payForThis - penaltyPortion;
        const interestPortion = Math.min(afterPenalty, interestRemaining);
        const principalPortion = afterPenalty - interestPortion;

        totalPenaltyApplied += penaltyPortion;
        totalInterestApplied += interestPortion;
        totalPrincipalApplied += principalPortion;
        runningBalance = Math.max(0, runningBalance - principalPortion);

        // ── Update installment record ─────────────────────────────────────
        const newPaidAmount = Number((currentPaid + payForThis).toFixed(2));
        // Fully paid when both the base installment and any penalty are covered
        const installmentTotal = Number(installment.totalAmount) + Number(installment.penaltyAmount || 0);
        const isFullyPaid = newPaidAmount >= installmentTotal - 0.01;
        const isMissed = paymentDate > new Date(installment.dueDate);

        const newPenaltyPaid = Number((Number(installment.penaltyPaid || 0) + penaltyPortion).toFixed(2));

        await installment.update({
          paidAmount: newPaidAmount,
          penaltyPaid: newPenaltyPaid,
          paidDate: isFullyPaid ? paymentDate : installment.paidDate,
          status: isFullyPaid ? 'paid' : 'partial',
          isMissed: isMissed || installment.isMissed,
          remainingBalance: Number(runningBalance.toFixed(2))
        }, { transaction });

        logger.info(
          `Installment #${installment.installmentNumber} loan ${loanId}: ` +
          `paid=${newPaidAmount}/${installmentTotal.toFixed(2)} status=${isFullyPaid ? 'paid' : 'partial'} ` +
          `(penalty=${penaltyPortion.toFixed(2)}, interest=${interestPortion.toFixed(2)}, principal=${principalPortion.toFixed(2)})`
        );

        remaining -= payForThis;
      }

      // Determine nextPaymentDate from the first still-unpaid installment
      const nextUnpaid = await RepaymentSchedule.findOne({
        where: { loanId, status: ['pending', 'partial', 'overdue'] },
        order: [['installmentNumber', 'ASC']],
        transaction
      });

      return {
        appliedToPrincipal: Number(totalPrincipalApplied.toFixed(2)),
        appliedToInterest: Number(totalInterestApplied.toFixed(2)),
        appliedToPenalty: Number(totalPenaltyApplied.toFixed(2)),
        nextDueDate: nextUnpaid ? nextUnpaid.dueDate : null
      };

    } catch (error) {
      logger.error(`Error applying payment to schedule for loan ${loanId}: ${error.message}`);
      throw error;
    }
  },

  async getAllPayments({ role, userId, page = 1, limit = 20, method } = {}) {
  try {
    logger.info(`paymentService.getAllPayments called by user ${userId} (role: ${role})`);

    const processorInclude = {
      model: User,
      attributes: ['id', 'first_name', 'last_name', 'email'],
      required: false,
    };

    const staffRoles = [1, 2, 3];
    const isStaff = staffRoles.includes(Number(role));
    const loanWhere = isStaff ? {} : { clientId: userId };
    const loanInclude = {
      model: Loan,
      required: !isStaff,
      where: Object.keys(loanWhere).length ? loanWhere : undefined,
      include: [{ association: 'client', required: false, attributes: ['id', 'firstName', 'lastName'] }],
    };

    const where = {};
    if (method) where.paymentMethod = method;

    const offset = (page - 1) * limit;
    const { count, rows } = await Payment.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      distinct: true,
      include: [loanInclude, processorInclude],
    });

    logger.info(`Retrieved ${rows.length} payments (page=${page}, total=${count})`);
    return { total: count, page, limit, pages: Math.ceil(count / limit), payments: rows };
  } catch (err) {
    logger.error(`Error in getAllPayments: ${err.message}`);
    throw err;
  }
},

async getPaymentsByLoan(loanId) {
  try {
    logger.info(`Fetching payments for loan ${loanId}`);
    return await Payment.findAll({
      where: { loanId },
      include: [{
        model: User,
        attributes: ['id', 'first_name', 'last_name', 'email'],
        required: false,
      }],
    });
  } catch (err) {
    logger.error(`Error in getPaymentsByLoan: ${err.message}`);
    throw err;
  }
},

/**
 * Records a payment on an approved (not yet disbursed) loan as a down payment.
 * Must be called within an existing transaction; the caller commits.
 *
 * Posts DR 1001 Cash / CR 2100 Loan Downpayments Held and increments the loan's
 * downPaymentPaid. Creates a Payment record (appliedToPrincipal/Interest = 0) so
 * the collection is traceable in the payments ledger.
 *
 * @param {Object} loan - Loan instance
 * @param {Object} data - Payment data
 * @param {number} paymentAmount - Validated amount
 * @param {number} creatorId
 * @param {string} userAgent
 * @param {Object} t - Open Sequelize transaction
 * @returns {Promise<{payment: Object, downPayment: boolean}>}
 */
async recordDownPayment(loan, data, paymentAmount, creatorId, userAgent, t) {
  const required = Number(loan.downPaymentRequired || 0);
  const alreadyPaid = Number(loan.downPaymentPaid || 0);
  const remaining = Number((required - alreadyPaid).toFixed(2));

  if (remaining <= 0) {
    throw new Error('Down payment for this loan has already been fully collected');
  }
    if (paymentAmount > remaining + CURRENCY_EPSILON) {
    throw new Error(
      `Down payment amount (${paymentAmount}) exceeds the outstanding down payment (${remaining})`
    );
  }

  const payment = await Payment.create({
    loanId: loan.id,
    amount: paymentAmount,
    currency: data.currency || loan.currency,
    paymentMethod: data.paymentMethod || 'cash',
    externalRef: data.externalRef || `TX-${uuidv4().split('-')[0].toUpperCase()}`,
    payerName: data.payerName || null,
    payerPhone: data.payerPhone || null,
    transactionDate: data.transactionDate ? new Date(data.transactionDate) : new Date(),
    paymentDate: new Date(),
    appliedToPrincipal: 0,
    appliedToInterest: 0,
    appliedToDownPayment: paymentAmount,
    fees: 0,
    penalties: 0,
    processedBy: creatorId,
    notes: data.notes ? `Down payment – ${data.notes}` : 'Down payment',
  }, { transaction: t });

  await ledgerService.postDownPaymentCollectionEntry(loan, paymentAmount, creatorId, t);

  const newPaid = Number((alreadyPaid + paymentAmount).toFixed(2));
  await loan.update({ downPaymentPaid: newPaid }, { transaction: t });

  await AuditLogger.log({
    entityType: 'PAYMENT',
    entityId: payment.id,
    action: 'CREATE',
    data: {
      loanId: loan.id,
      amount: paymentAmount,
      downPayment: true,
      downPaymentPaid: newPaid,
      downPaymentRequired: required,
    },
    actorId: creatorId || 1,
    options: { actorType: 'USER', source: userAgent },
  });

  logger.info(
    `Down payment ${payment.id} of ${paymentAmount} recorded for approved loan ${loan.id} ` +
    `(total ${newPaid}/${required})`
  );

  return { payment, downPayment: true };
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
      include: [{ model: LoanProduct, as: 'loanProduct' }],
      transaction: t
    });
    if (!loan) throw new Error('Loan not found');

    // Validate client ownership
    if (Number(loan.clientId) !== Number(data.clientId)) {
      throw new Error('Client ID does not match loan client');
    }

    // Validate payment currency matches loan currency
    if (data.currency && data.currency.toUpperCase() !== loan.currency.toUpperCase()) {
      throw new Error(
        `Currency mismatch: payment currency '${data.currency}' does not match loan currency '${loan.currency}'`
      );
    }

    // Validate externalRef uniqueness per client if provided.
    // Scoped to client (via loan.clientId) because different payment providers
    // may coincidentally generate the same reference for different clients.
    if (data.externalRef) {
      const existing = await Payment.findOne({
        where: { externalRef: data.externalRef },
        include: [{ model: Loan, where: { clientId: data.clientId }, required: true }],
        transaction: t
      });
      if (existing) {
        throw new Error(`Duplicate external reference: '${data.externalRef}' already exists for this client (payment ID ${existing.id})`);
      }
    }

    const paymentAmount = Number(parseFloat(data.amount));
    if (!isFinite(paymentAmount) || paymentAmount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    // ── Down payment branch ───────────────────────────────────────────
    // An approved (not yet disbursed) loan that requires a down payment accepts
    // payments as down-payment collection. The cash is held in liability account
    // 2100 until disbursement (applied against principal) or deletion (transferred
    // to member contributions). No repayment schedule exists yet, so the normal
    // schedule application below is skipped.
    if (loan.status === LoanStatus.APPROVED && Number(loan.downPaymentRequired || 0) > 0) {
      const result = await this.recordDownPayment(loan, data, paymentAmount, creatorId, userAgent, t);
      await t.commit();
      return result;
    }

    // ── Step 1b: Ensure loan is in a payable state ────────────────────
    const payableStatuses = [
      LoanStatus.DISBURSED,
      LoanStatus.ACTIVE,
      LoanStatus.PARTIALLY_PAID,
      LoanStatus.OVERDUE
    ];
    if (!payableStatuses.includes(loan.status)) {
      throw new Error(`Loan is not in a payable state. Current status: ${loan.status}`);
    }

    // ── Step 2: Validate amount against schedule ──────────────────────
    // Use total remaining on schedule (principal + interest + penalty) instead
    // of outstandingBalance alone, so the final payment is not rejected.
    const pendingInstallments = await RepaymentSchedule.findAll({
      where: { loanId: data.loanId, status: ['pending', 'partial', 'overdue'] },
      transaction: t
    });
    const totalOwed = pendingInstallments.reduce((sum, inst) => {
      const baseDue = Number(inst.totalAmount) - Number(inst.paidAmount || 0);
      const penaltyDue = Math.max(0, Number(inst.penaltyAmount || 0) - Number(inst.penaltyPaid || 0));
      return sum + baseDue + penaltyDue;
    }, 0);

    // Compute overpayment surplus — amount beyond total owed goes to member contributions
    const rawSurplus = Math.max(0, Number((paymentAmount - totalOwed).toFixed(2)));

    // Ignore immaterial surpluses (rounding noise): absorb them into the payment
    // instead of posting a trivial member contribution + journal line.
    // Threshold is configurable via system_config key 'payment.min_overpayment_surplus'.
    const minSurplus = await systemConfigService.getConfigValue('payment.min_overpayment_surplus', 'number', 1);
    const surplus = rawSurplus >= minSurplus ? rawSurplus : 0;
    const effectiveAmount = Number((paymentAmount - surplus).toFixed(2));

    const outstanding = Number(parseFloat(loan.outstandingBalance));

    // ── Step 3: Apply payment to repayment schedule ───────────────────
    // Only apply the loan portion (effectiveAmount) to the schedule.
    // Any surplus is routed to member contributions after this step.
    const { appliedToPrincipal, appliedToInterest, appliedToPenalty, nextDueDate } =
      await this.applyPaymentToSchedule(
        data.loanId, effectiveAmount, new Date(), outstanding, t
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
      appliedToPenalty,
      fees: data.fees || 0,
      penalties: data.penalties || 0,
      processedBy: creatorId,
      notes: data.notes || null,
    }, { transaction: t });

    // ── Step 4b: Post ledger entry ────────────────────────────────────
    // Pass surplus so postPaymentEntry adds a CR 3001 Member Contributions line
    const { entry: paymentJournalEntry } = await ledgerService.postPaymentEntry(payment, loan, t, surplus);

    // ── Step 5: Update loan summary fields ────────────────────────────
    // outstandingBalance tracks remaining principal only
    let newBalance = Math.max(0, Number((outstanding - appliedToPrincipal).toFixed(2)));
    const currentAmountRepaid = Number(loan.amountRepaid || 0);
    // Reduce the running penalty balance by what was just collected
    const newPenaltiesBalance = Math.max(0, Number((Number(loan.penalties || 0) - appliedToPenalty).toFixed(2)));

    // The schedule is the source of truth for whether the loan is settled.
    // When no pending/partial installments remain (nextDueDate === null), the
    // loan is fully repaid — clear any residual left by per-installment rounding
    // so the balance doesn't get "stuck" at a few cents.
    const scheduleFullyPaid = !nextDueDate;
    if (scheduleFullyPaid) {
      newBalance = 0;
    }

    const loanUpdates = {
      outstandingBalance: newBalance,
      penalties: newPenaltiesBalance,
      // amountRepaid tracks cash applied to the loan (excludes overpayment surplus)
      amountRepaid: Number((currentAmountRepaid + effectiveAmount).toFixed(2)),
      noOfRepayments: Number(loan.noOfRepayments || 0) + 1,
      nextPaymentDate: nextDueDate || null,
    };

    // Transition loan status: closed when fully repaid, otherwise activate.
    if (newBalance <= 0 || scheduleFullyPaid) {
      loanUpdates.status = LoanStatus.CLOSED;
    } else if (loan.status === LoanStatus.DISBURSED) {
      loanUpdates.status = LoanStatus.ACTIVE;
    }

    /**
     * When the loan is fully settled, reconcile any lingering schedule rows.
     * Per-installment interest/principal splits are rounded to 2 decimals, so
     * the final installment can be left a cent or two short and flagged
     * 'partial' even though the loan is paid off. Force-close them so the
     * schedule matches the closed loan.
     */
    if (loanUpdates.status === LoanStatus.CLOSED) {
      loanUpdates.nextPaymentDate = null;
      const leftover = await RepaymentSchedule.findAll({
        where: { loanId: data.loanId, status: ['pending', 'partial'] },
        transaction: t,
      });
      if (leftover.length > 0) {
        logger.info(`Reconciling ${leftover.length} leftover schedule rows for fully repaid loan ${loan.id}`);
        for (const inst of leftover) {
          await inst.update({
            paidAmount: Number(inst.totalAmount),
            paidDate: inst.paidDate || new Date(),
            status: 'paid',
            remainingBalance: 0,
          }, { transaction: t });
        }
      }
    }

    await loan.update(loanUpdates, { transaction: t });

    // ── Step 5b: Credit overpayment to member contributions ──────────
    let overpaymentContribution = null;
    if (surplus > 0) {
      overpaymentContribution = await memberContributionService.creditOverpayment({
        clientId: loan.clientId,
        surplus,
        loanId: loan.id,
        paymentId: payment.id,
        journalEntryId: paymentJournalEntry.id,
        createdBy: creatorId,
        source: userAgent,
        transaction: t,
      });
      logger.info(
        `Overpayment of ${surplus} for loan ${loan.id} credited to member ${loan.clientId} contributions`
      );
    }

    // ── Step 6: Audit log ─────────────────────────────────────────────
    await AuditLogger.log({
      entityType: 'PAYMENT',
      entityId: payment.id,
      action: 'CREATE',
      data: {
        loanId: data.loanId,
        amount: paymentAmount,
        effectiveAmount,
        appliedToPrincipal,
        appliedToInterest,
        newBalance,
        externalRef: payment.externalRef,
        ...(surplus > 0 ? { overpaymentSurplus: surplus, overpaymentContributionId: overpaymentContribution?.id } : {})
      },
      actorId: creatorId || 1,
      options: {
        actorType: 'USER',
        source: userAgent
      }
    });

    await t.commit();

    // ── Step 7: Emit loan transaction event (after commit) ────────────
    emitLoanTransaction({
      loanId: loan.id,
      transactionType: LoanTransactionType.REPAYMENT,
      direction: 'CREDIT',
      amount: effectiveAmount,
      currency: loan.currency,
      principalBalance: newBalance,
      interestBalance: 0,
      feesBalance: Number(payment.fees || 0),
      penaltiesBalance: newPenaltiesBalance,
      totalBalance: newBalance,
      referenceId: payment.id,
      referenceType: 'payment',
      transactionDate: payment.transactionDate || new Date(),
      notes: `Payment ${payment.externalRef}: principal=${appliedToPrincipal}, interest=${appliedToInterest}` +
             (appliedToPenalty > 0 ? `, penalty=${appliedToPenalty}` : ''),
      createdBy: creatorId || null,
    });

    logger.info(
      `Payment ${payment.id} recorded for loan ${loan.id}: ` +
      `amount=${paymentAmount} (penalty=${appliedToPenalty}, principal=${appliedToPrincipal}, interest=${appliedToInterest}` +
      (surplus > 0 ? `, overpayment=${surplus}` : '') + `). ` +
      `New balance: ${newBalance}` +
      (loanUpdates.status ? `, status→${loanUpdates.status}` : '')
    );

    return { payment, overpaymentContribution };
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
      actorId: deletorId || 1,
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