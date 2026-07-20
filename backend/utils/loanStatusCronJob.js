/**
 * loanStatusCronJob
 *
 * Runs daily at 01:00 AM and:
 *  1. Marks installments past their due date → status='overdue', isMissed=true
 *  2. Updates loan.missedPaymentsCount
 *  3. Escalates loan status based on configurable thresholds:
 *       ≥ overdue_missed_count  → OVERDUE
 *       ≥ defaulted_missed_count → DEFAULTED  (+ auto-provisions overdue balance)
 *  4. De-escalates: OVERDUE → ACTIVE when all installments are back up to date
 *     and reverses any outstanding provision.
 *
 * Thresholds are stored in system_configs:
 *   loans.overdue_missed_count    (default 1)
 *   loans.defaulted_missed_count  (default 3 — approx. 90 days for monthly loans)
 */

const cron = require('node-cron');
const { Op } = require('sequelize');
const Loan = require('../models/loanModel');
const RepaymentSchedule = require('../models/repaymentScheduleModel');
const SystemConfig = require('../models/systemConfigModel');
const LoanStatus = require('../enums/loanStatus');
const LoanTransactionType = require('../enums/loanTransactionType');
const ledgerService = require('../services/ledgerService');
const penaltyService = require('../services/penaltyService');
const { emitLoanTransaction } = require('./loanTransactionEmitter');
const AuditLogger = require('./auditLogger');
const logger = require('../config/logger');

// Loan statuses the job actively monitors
const MONITORED_STATUSES = [
  LoanStatus.DISBURSED,
  LoanStatus.ACTIVE,
  LoanStatus.OVERDUE,
  LoanStatus.PARTIALLY_PAID,
  LoanStatus.PARTIALLY_WRITTEN_OFF,
];

// Statuses that must never be automatically escalated further
const TERMINAL_STATUSES = new Set([
  LoanStatus.WRITTEN_OFF,
  LoanStatus.CLOSED,
  LoanStatus.CANCELLED,
  LoanStatus.DELETED,
  LoanStatus.RECOVERED,
]);

// ─── threshold helpers ────────────────────────────────────────────────────────

async function getThresholds() {
  const rows = await SystemConfig.findAll({
    where: { key: { [Op.in]: ['loans.overdue_missed_count', 'loans.defaulted_missed_count'] } },
  });
  const map = Object.fromEntries(rows.map(r => [r.key, parseInt(r.value, 10)]));
  return {
    overdueAt:   isNaN(map['loans.overdue_missed_count'])   ? 1 : map['loans.overdue_missed_count'],
    defaultedAt: isNaN(map['loans.defaulted_missed_count']) ? 3 : map['loans.defaulted_missed_count'],
  };
}

// ─── per-loan processor ───────────────────────────────────────────────────────

async function processLoan(loan, today, overdueAt, defaultedAt, penaltyConfig, summary) {
  const schedules = loan.repaymentSchedules || [];
  const oldStatus = loan.status;

  // ── Step 1: scan installments, count overdue, mark them ──────────────────
  let overdueCount = 0;

  for (const s of schedules) {
    if (s.status === 'paid' || s.status === 'written_off') continue;

    const dueDate = new Date(s.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    if (dueDate < today) {
      overdueCount++;
      const needsUpdate = s.status === 'pending' || !s.isMissed;
      if (needsUpdate) {
        await s.update({ status: 'overdue', isMissed: true });
      }
    }
  }

  // ── Step 2: sync missedPaymentsCount ──────────────────────────────────────
  if (Number(loan.missedPaymentsCount) !== overdueCount) {
    await loan.update({ missedPaymentsCount: overdueCount });
  }

  // ── Step 2b: apply penalties for newly-missed installments ────────────────
  if (overdueCount > 0) {
    try {
      await penaltyService.applyPenalties(loan, today, penaltyConfig);
    } catch (penaltyErr) {
      logger.error(`[LoanStatusCron] Penalty error on loan ${loan.id}: ${penaltyErr.message}`);
      // Non-fatal: continue status escalation
    }
  }

  // Skip further escalation for terminal/written-off statuses
  if (TERMINAL_STATUSES.has(oldStatus) || oldStatus === LoanStatus.DEFAULTED && overdueCount >= defaultedAt) {
    return;
  }

  // ── Step 3a: De-escalate — OVERDUE → ACTIVE when fully caught up ──────────
  if (overdueCount === 0 && oldStatus === LoanStatus.OVERDUE) {
    await loan.update({ status: LoanStatus.ACTIVE });
    summary.recovered++;

    // Reverse any outstanding provision
    const provisioned = Number(loan.provisionedAmount || 0);
    if (provisioned > 0) {
      await ledgerService.postProvisionReversalEntry(loan, provisioned, null);
      await loan.update({ provisionedAmount: 0 });

      emitLoanTransaction({
        loanId: loan.id,
        transactionType: LoanTransactionType.PROVISION_REVERSAL,
        direction: 'DEBIT',
        amount: provisioned,
        currency: loan.currency,
        principalBalance: Number(loan.outstandingBalance),
        interestBalance: 0,
        feesBalance: 0,
        penaltiesBalance: 0,
        totalBalance: Number(loan.outstandingBalance),
        referenceType: 'loan',
        referenceId: loan.id,
        transactionDate: new Date(),
        notes: `Cron: provision reversed — loan ${loan.referenceCode} fully caught up`,
        createdBy: null,
      });
    }

    await AuditLogger.log({
      entityType: 'LOAN',
      entityId: loan.id,
      action: 'STATUS_CHANGE',
      data: { from: oldStatus, to: LoanStatus.ACTIVE, reason: 'Cron: all installments up to date' },
      actorId: AuditLogger.SYSTEM_USER_ID,
      options: { actorType: 'SYSTEM', source: 'cron' },
    });

    return;
  }

  // ── Step 3b: Escalate OVERDUE → DEFAULTED ─────────────────────────────────
  if (overdueCount >= defaultedAt && oldStatus !== LoanStatus.DEFAULTED) {
    await loan.update({ status: LoanStatus.DEFAULTED });
    summary.markedDefaulted++;

    // Auto-provision: only the overdue installment balances
    const overdueInstallments = schedules.filter(s => s.isMissed && s.status !== 'paid' && s.status !== 'written_off');
    const overdueTotal = Number(
      overdueInstallments
        .reduce((sum, s) => sum + Math.max(0, Number(s.totalAmount) - Number(s.paidAmount || 0)), 0)
        .toFixed(2)
    );

    // Only post the net change so we never double-count an existing provision.
    //   gap > 0 → top-up  (post additional provision)
    //   gap < 0 → excess  (reverse over-provisioned amount)
    //   gap = 0 → no-op
    const existingProvisioned = Number(loan.provisionedAmount || 0);
    const provisionGap = Number((overdueTotal - existingProvisioned).toFixed(2));

    if (Math.abs(provisionGap) >= 0.01) {
      if (provisionGap > 0) {
        await ledgerService.postProvisionEntry(loan, provisionGap, null);
      } else {
        await ledgerService.postProvisionReversalEntry(loan, Math.abs(provisionGap), null);
      }
      await loan.update({ provisionedAmount: overdueTotal });
      summary.provisioned++;

      emitLoanTransaction({
        loanId: loan.id,
        transactionType: provisionGap > 0 ? LoanTransactionType.PROVISION : LoanTransactionType.PROVISION_REVERSAL,
        direction: provisionGap > 0 ? 'CREDIT' : 'DEBIT',
        amount: Math.abs(provisionGap),
        currency: loan.currency,
        principalBalance: Number(loan.outstandingBalance),
        interestBalance: 0,
        feesBalance: 0,
        penaltiesBalance: 0,
        totalBalance: Number(loan.outstandingBalance),
        referenceType: 'loan',
        referenceId: loan.id,
        transactionDate: new Date(),
        notes: `Cron: provision ${provisionGap > 0 ? 'top-up' : 'excess reversal'} on DEFAULTED — ` +
          `existing=${existingProvisioned}, target=${overdueTotal}, gap=${provisionGap} — ${loan.referenceCode}`,
        createdBy: null,
      });
    }

    await AuditLogger.log({
      entityType: 'LOAN',
      entityId: loan.id,
      action: 'STATUS_CHANGE',
      data: {
        from: oldStatus,
        to: LoanStatus.DEFAULTED,
        missedPaymentsCount: overdueCount,
        provisionedAmount: overdueTotal,
        reason: `Cron: ${overdueCount} missed installments ≥ threshold of ${defaultedAt}`,
      },
      actorId: AuditLogger.SYSTEM_USER_ID,
      options: { actorType: 'SYSTEM', source: 'cron' },
    });

    return;
  }

  // ── Step 3c: Escalate ACTIVE / DISBURSED / PARTIALLY_PAID → OVERDUE ───────
  const canEscalateToOverdue = [
    LoanStatus.ACTIVE,
    LoanStatus.DISBURSED,
    LoanStatus.PARTIALLY_PAID,
    LoanStatus.PARTIALLY_WRITTEN_OFF,
  ].includes(oldStatus);

  if (overdueCount >= overdueAt && canEscalateToOverdue) {
    await loan.update({ status: LoanStatus.OVERDUE });
    summary.markedOverdue++;

    await AuditLogger.log({
      entityType: 'LOAN',
      entityId: loan.id,
      action: 'STATUS_CHANGE',
      data: {
        from: oldStatus,
        to: LoanStatus.OVERDUE,
        missedPaymentsCount: overdueCount,
        reason: `Cron: ${overdueCount} installment(s) past due`,
      },
      actorId: AuditLogger.SYSTEM_USER_ID,
      options: { actorType: 'SYSTEM', source: 'cron' },
    });
  }
}

// ─── main run ─────────────────────────────────────────────────────────────────

async function run() {
  const startTime = Date.now();
  logger.info('[LoanStatusCron] Starting daily loan status job');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { overdueAt, defaultedAt } = await getThresholds();
  logger.info(`[LoanStatusCron] Thresholds — overdue: ${overdueAt}, defaulted: ${defaultedAt} missed installments`);

  const penaltyConfig = await penaltyService.getPenaltyConfig();
  logger.info(`[LoanStatusCron] Penalty config — enabled: ${penaltyConfig.penaltyEnabled}, graceDays: ${penaltyConfig.graceDays}`);

  const loans = await Loan.findAll({
    where: { status: { [Op.in]: MONITORED_STATUSES } },
    include: [{ association: 'repaymentSchedules', required: false }],
  });

  const summary = {
    checked: loans.length,
    markedOverdue: 0,
    markedDefaulted: 0,
    recovered: 0,
    provisioned: 0,
    errors: 0,
  };

  for (const loan of loans) {
    try {
      await processLoan(loan, today, overdueAt, defaultedAt, penaltyConfig, summary);
    } catch (err) {
      summary.errors++;
      logger.error(`[LoanStatusCron] Error processing loan ${loan.id}: ${err.message}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(
    `[LoanStatusCron] Done in ${elapsed}s — ` +
    `checked: ${summary.checked}, ` +
    `overdue: ${summary.markedOverdue}, ` +
    `defaulted: ${summary.markedDefaulted}, ` +
    `recovered: ${summary.recovered}, ` +
    `provisioned: ${summary.provisioned}, ` +
    `errors: ${summary.errors}`
  );

  return summary;
}

/**
 * Register the cron schedule. Call once at server startup.
 * Runs daily at 01:00 AM server time.
 */
function register() {
  cron.schedule('0 1 * * *', async () => {
    try {
      await run();
    } catch (err) {
      logger.error(`[LoanStatusCron] Unhandled error: ${err.message}`);
    }
  }, {
    timezone: process.env.TZ || 'Africa/Nairobi',
  });

  logger.info('[LoanStatusCron] Scheduled — daily at 01:00 AM');
}

module.exports = { register, run };
