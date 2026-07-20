/**
 * penaltyService
 *
 * Handles penalty accrual for overdue loan installments.
 *
 * Charge rules (per plan decisions):
 *  - Triggered by the daily cron after installments are marked overdue.
 *  - Penalty is charged ONCE per installment (idempotency via penaltyApplied flag).
 *  - Only charged after the configurable grace period (loans.penalty.grace_days) has passed.
 *  - Penalty amount = penaltyRate% × (sum of unpaid overdue installments past grace).
 *    Each new miss increments the running cumulative base and stakes onto loan.penalties.
 *  - Creates a system-generated PENALTY LoanTransaction (memo, no GL posting — cash basis).
 *  - Audit-logged with actorType=SYSTEM.
 */

const sequelize = require('../config/sequalize_db');
const Loan = require('../models/loanModel');
const LoanProduct = require('../models/loanProductModel');
const RepaymentSchedule = require('../models/repaymentScheduleModel');
const SystemConfig = require('../models/systemConfigModel');
const systemConfigService = require('./systemConfigService');
const LoanTransactionType = require('../enums/loanTransactionType');
const { emitLoanTransaction } = require('../utils/loanTransactionEmitter');
const AuditLogger = require('../utils/auditLogger');
const logger = require('../config/logger');

const penaltyService = {

  /**
   * Apply penalty charges to a single loan for all newly-missed installments.
   *
   * Called from loanStatusCronJob.processLoan after overdue detection.
   *
   * @param {object} loan         - Sequelize Loan instance (with repaymentSchedules association)
   * @param {Date}   today        - Cron's reference "today" (midnight)
   * @param {object} config       - { penaltyEnabled: boolean, graceDays: number }
   * @returns {Promise<{ penaltyCharged: number }>}
   */
  async applyPenalties(loan, today, config) {
    const { penaltyEnabled, graceDays } = config;

    if (!penaltyEnabled) return { penaltyCharged: 0 };

    // Fetch the product penaltyRate
    const product = await LoanProduct.findByPk(loan.loanProductId);
    if (!product) {
      logger.warn(`[PenaltyService] Loan ${loan.id}: product not found, skipping`);
      return { penaltyCharged: 0 };
    }

    const penaltyRate = Number(product.penaltyRate || 0);
    if (penaltyRate <= 0) return { penaltyCharged: 0 };

    // Reload schedule rows for this loan (in case the cron passed a stale association)
    const schedules = await RepaymentSchedule.findAll({
      where: { loanId: loan.id },
      order: [['installmentNumber', 'ASC']],
    });

    // Find installments that:
    //  a) are past grace period
    //  b) not yet paid / written-off
    //  c) have NOT yet had a penalty applied (idempotency)
    const graceCutoff = new Date(today);
    graceCutoff.setDate(graceCutoff.getDate() - graceDays);

    const newlyChargeableInstallments = schedules.filter((s) => {
      const due = new Date(s.dueDate);
      due.setHours(0, 0, 0, 0);
      return (
        due < graceCutoff &&
        s.status !== 'paid' &&
        s.status !== 'written_off' &&
        !s.penaltyApplied
      );
    });

    if (newlyChargeableInstallments.length === 0) return { penaltyCharged: 0 };

    // Cumulative base = sum of unpaid portions of ALL currently overdue past-grace installments
    // (includes installments charged in a previous run — they remain unpaid and contribute to the base)
    const allOverduePastGrace = schedules.filter((s) => {
      const due = new Date(s.dueDate);
      due.setHours(0, 0, 0, 0);
      return (
        due < graceCutoff &&
        s.status !== 'paid' &&
        s.status !== 'written_off'
      );
    });

    const cumulativeBase = allOverduePastGrace.reduce((sum, s) => {
      return sum + Math.max(0, Number(s.totalAmount) - Number(s.paidAmount || 0));
    }, 0);

    if (cumulativeBase <= 0) return { penaltyCharged: 0 };

    // Calculate the new penalty charge: penaltyRate% of cumulative base
    const penaltyCharge = Number((cumulativeBase * penaltyRate / 100).toFixed(2));
    if (penaltyCharge <= 0) return { penaltyCharged: 0 };

    const t = await sequelize.transaction();
    try {
      // Mark each newly chargeable installment as penaltyApplied and add a
      // proportional share of the total charge to its penaltyAmount.
      // (Proportional split for traceability; total always equals penaltyCharge.)
      const share = Number((penaltyCharge / newlyChargeableInstallments.length).toFixed(2));
      let distributed = 0;

      for (let i = 0; i < newlyChargeableInstallments.length; i++) {
        const s = newlyChargeableInstallments[i];
        // Last installment absorbs any rounding residual
        const portionAdd = (i === newlyChargeableInstallments.length - 1)
          ? Number((penaltyCharge - distributed).toFixed(2))
          : share;
        distributed += portionAdd;

        await s.update({
          penaltyAmount: Number((Number(s.penaltyAmount || 0) + portionAdd).toFixed(2)),
          penaltyApplied: true,
        }, { transaction: t });
      }

      // Accumulate onto the loan's running penalty balance
      const previousPenalties = Number(loan.penalties || 0);
      const newPenalties = Number((previousPenalties + penaltyCharge).toFixed(2));
      await loan.update({ penalties: newPenalties }, { transaction: t });

      await t.commit();

      // Emit memo transaction (no GL — cash basis; recognised when paid)
      emitLoanTransaction({
        loanId: loan.id,
        transactionType: LoanTransactionType.PENALTY,
        direction: 'DEBIT',
        amount: penaltyCharge,
        currency: loan.currency,
        principalBalance: Number(loan.outstandingBalance),
        interestBalance: 0,
        feesBalance: 0,
        penaltiesBalance: newPenalties,
        totalBalance: Number(loan.outstandingBalance),
        referenceType: 'loan',
        referenceId: loan.id,
        transactionDate: new Date(),
        notes: `Cron: penalty charged — ${newlyChargeableInstallments.length} newly-missed installment(s), base=${cumulativeBase}, rate=${penaltyRate}%, charge=${penaltyCharge}`,
        createdBy: AuditLogger.SYSTEM_USER_ID,
      });

      await AuditLogger.log({
        entityType: 'LOAN',
        entityId: loan.id,
        action: 'PENALTY_CHARGE',
        data: {
          penaltyCharge,
          penaltyRate,
          cumulativeBase,
          newlyChargedInstallments: newlyChargeableInstallments.map(s => s.installmentNumber),
          previousPenalties,
          newPenalties,
        },
        actorId: AuditLogger.SYSTEM_USER_ID,
        options: { actorType: 'SYSTEM', source: 'cron' },
      });

      logger.info(
        `[PenaltyService] Loan ${loan.id} (${loan.referenceCode}): ` +
        `charged ${penaltyCharge} (rate=${penaltyRate}%, base=${cumulativeBase}) — ` +
        `installments [${newlyChargeableInstallments.map(s => s.installmentNumber).join(', ')}]. ` +
        `Running penalties: ${previousPenalties} → ${newPenalties}`
      );

      return { penaltyCharged: penaltyCharge };

    } catch (err) {
      await t.rollback();
      logger.error(`[PenaltyService] Loan ${loan.id}: ${err.message}`);
      throw err;
    }
  },

  /**
   * Reads penalty-related config values from system_configs.
   * Called once per cron run to avoid N+1 config fetches.
   *
   * @returns {Promise<{ penaltyEnabled: boolean, graceDays: number }>}
   */
  async getPenaltyConfig() {
    const [penaltyEnabled, graceDays] = await Promise.all([
      systemConfigService.getConfigValue('loans.penalty.enabled', 'boolean', false),
      systemConfigService.getConfigValue('loans.penalty.grace_days', 'number', 0),
    ]);
    return { penaltyEnabled, graceDays: Math.max(0, graceDays) };
  },

};

module.exports = penaltyService;
