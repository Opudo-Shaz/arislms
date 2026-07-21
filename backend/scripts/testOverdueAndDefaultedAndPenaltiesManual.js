/**
 * testOverdueAndDefaultedAndPenaltiesManual.js
 *
 * Manual penalty / overdue transition tester.
 *
 * Usage:
 *   node scripts/testOverdueAndDefaultedAndPenaltiesManual.js --loan <loanId> [--backdate <days>] [--reset]
 *
 * Options:
 *   --loan    <id>    Required. Loan ID to test against.
 *   --backdate <n>    Shift all pending/partial installment due dates n days into
 *                     the past (default: 35 — enough to trigger overdue + penalty
 *                     with a 0-day grace period and a defaulted threshold of 3).
 *   --reset           Restore due dates (+backdate days) and clear penalty fields,
 *                     then exit. Use to undo after testing.
 *
 * What it does (without --reset):
 *   1. Backdates installment due dates so they appear overdue.
 *   2. Enables the penalty config (loans.penalty.enabled = true) in system_configs.
 *   3. Runs the full cron job (loanStatusCronJob.run) — marks overdue, applies
 *      penalties, escalates loan status exactly as the nightly job would.
 *   4. Prints a summary of the loan's updated state and any LoanTransactions
 *      created during the run.
 *
 * The script never modifies production data permanently — use --reset to revert
 * the due-date shift. The penalty.enabled flag stays on until you toggle it off
 * in the admin UI or re-run with --reset.
 */

'use strict';

const path = require('path');
const loadEnv = require('../config/env');
loadEnv({ path: path.resolve(__dirname, '../.env') });

const sequelize         = require('../config/sequalize_db');
const Loan              = require('../models/loanModel');
const RepaymentSchedule = require('../models/repaymentScheduleModel');
const LoanTransaction   = require('../models/loanTransactionModel');
const SystemConfig      = require('../models/systemConfigModel');
const ledgerService     = require('../services/ledgerService');
const LoanTransactionType = require('../enums/loanTransactionType');
const { emitLoanTransaction } = require('../utils/loanTransactionEmitter');
const { run: runCron }  = require('../utils/loanStatusCronJob');

// ── CLI arg parsing ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const get  = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};

const loanId   = Number(get('--loan'));
const backdate = Number(get('--backdate') || 35);
const reset    = args.includes('--reset');

if (!loanId || isNaN(loanId)) {
  console.error('Usage: node scripts/testOverdueAndDefaultedAndPenaltiesManual.js --loan <loanId> [--backdate <days>] [--reset]');
  process.exit(1);
}

// ── helpers ──────────────────────────────────────────────────────────────────

function shiftDate(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function hr(char = '─', width = 60) {
  return char.repeat(width);
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  await sequelize.authenticate();
  console.log(hr());
  console.log(`  Loan Overdue, Defaulted, and Penalties Manual Tester — Loan #${loanId}`);
  console.log(hr());

  // 1. Load loan
  const loan = await Loan.findByPk(loanId, {
    include: [{ association: 'repaymentSchedules', required: false }],
  });
  if (!loan) {
    console.error(`Loan #${loanId} not found.`);
    process.exit(1);
  }

  const schedules = (loan.repaymentSchedules || [])
    .filter(s => !['paid', 'written_off'].includes(s.status));

  if (schedules.length === 0) {
    console.warn('No open installments found. Nothing to test.');
    process.exit(0);
  }

  // ── RESET mode ──────────────────────────────────────────────────────────
  if (reset) {
    console.log(`\nResetting ${schedules.length} installment(s) — shifting due dates forward ${backdate} day(s)…`);
    for (const s of schedules) {
      await s.update({
        dueDate:        shiftDate(s.dueDate, backdate),
        status:         'pending',
        isMissed:       false,
        penaltyAmount:  0,
        penaltyApplied: false,
      });
      console.log(`  Installment #${s.installmentNumber}: due ${s.dueDate} → ${shiftDate(s.dueDate, backdate)}, reset to pending`);
    }
    // Reverse any outstanding provision posted by the cron
    const provisioned = Number(loan.provisionedAmount || 0);
    if (provisioned > 0) {
      console.log(`\n  Reversing provision of ${provisioned} (account 1300)…`);
      await ledgerService.postProvisionReversalEntry(loan, provisioned, null);
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
        notes: `Test reset: provision reversed for loan ${loan.referenceCode}`,
        createdBy: null,
      });
      console.log(`  ✓ Provision of ${provisioned} reversed.`);
    } else {
      console.log('\n  No outstanding provision to reverse.');
    }

    await loan.update({ penalties: 0, missedPaymentsCount: 0, provisionedAmount: 0 });
    console.log('\n✓ Loan penalty balance, missed count, and provisioned amount cleared.');
    console.log('Note: loan status not automatically reverted — update manually if needed.\n');
    await sequelize.close();
    return;
  }

  // ── BACKDATE mode ────────────────────────────────────────────────────────

  console.log(`\nStep 1 — Backdating ${schedules.length} installment(s) by ${backdate} day(s)…`);
  for (const s of schedules) {
    const newDue = shiftDate(s.dueDate, -backdate);
    await s.update({ dueDate: newDue });
    console.log(`  Installment #${s.installmentNumber}: ${s.dueDate} → ${newDue}`);
  }

  // 2. Enable penalty in system config
  console.log('\nStep 2 — Ensuring loans.penalty.enabled = true in system_configs…');
  const [row, created] = await SystemConfig.findOrCreate({
    where: { key: 'loans.penalty.enabled' },
    defaults: {
      label:       'Loan Penalty Enabled',
      value:       'true',
      category:    'loans',
      description: 'Enable or disable automatic loan penalties on missed installments.',
      isBoolean:   true,
      isActive:    true,
    },
  });
  if (!created && row.value !== 'true') {
    await row.update({ value: 'true' });
    console.log('  Updated existing config to true.');
  } else {
    console.log(`  Config ${created ? 'created' : 'already true'}.`);
  }

  // Print current grace_days
  const graceCfg = await SystemConfig.findOne({ where: { key: 'loans.penalty.grace_days' } });
  const graceDays = graceCfg ? parseInt(graceCfg.value || '0', 10) : 0;
  console.log(`  Grace period: ${graceDays} day(s) (change via admin UI or system_configs table)`);

  // 3. Snapshot before
  await loan.reload();
  console.log('\nStep 3 — Loan state BEFORE cron run:');
  console.log(`  status          : ${loan.status}`);
  console.log(`  outstandingBalance: ${loan.outstandingBalance}`);
  console.log(`  penalties       : ${loan.penalties}`);
  console.log(`  missedPaymentsCount: ${loan.missedPaymentsCount}`);

  const txBefore = await LoanTransaction.count({ where: { loanId } });

  // 4. Run cron
  console.log('\nStep 4 — Running cron job…');
  console.log(hr('·'));
  const summary = await runCron();
  console.log(hr('·'));
  console.log('Cron summary:', JSON.stringify(summary, null, 2));

  // 5. Snapshot after
  await loan.reload();
  console.log('\nStep 5 — Loan state AFTER cron run:');
  console.log(`  status          : ${loan.status}`);
  console.log(`  outstandingBalance: ${loan.outstandingBalance}`);
  console.log(`  penalties       : ${loan.penalties}`);
  console.log(`  missedPaymentsCount: ${loan.missedPaymentsCount}`);

  // 6. Show new transactions
  const txAfter = await LoanTransaction.count({ where: { loanId } });
  const newTxCount = txAfter - txBefore;
  if (newTxCount > 0) {
    const newTxs = await LoanTransaction.findAll({
      where: { loanId },
      order: [['id', 'DESC']],
      limit: newTxCount,
    });
    console.log(`\nStep 6 — ${newTxCount} new LoanTransaction(s) created:`);
    for (const tx of newTxs.reverse()) {
      console.log(
        `  [${tx.id}] ${tx.transactionType.padEnd(20)} ${tx.direction.padEnd(6)} ` +
        `amount=${tx.amount}  penaltiesBalance=${tx.penaltiesBalance}  notes=${tx.notes?.slice(0, 80)}`
      );
    }
  } else {
    console.log('\nStep 6 — No new LoanTransactions created.');
  }

  // 7. Show updated schedule rows
  const updatedSchedules = await RepaymentSchedule.findAll({
    where: { loanId },
    order: [['installmentNumber', 'ASC']],
  });
  console.log('\nStep 7 — Updated repayment schedule:');
  console.log('  #   | dueDate    | status   | penaltyApplied | penaltyAmount | paidAmount');
  console.log('  ' + hr('-', 74));
  for (const s of updatedSchedules) {
    console.log(
      `  ${String(s.installmentNumber).padEnd(3)} | ${s.dueDate} | ${s.status.padEnd(8)} | ` +
      `${String(s.penaltyApplied).padEnd(14)} | ${String(s.penaltyAmount).padEnd(13)} | ${s.paidAmount}`
    );
  }

  console.log(`\n${hr()}`);
  console.log('  Done. Run with --reset to restore due dates.\n');
  console.log(`  node scripts/testPenaltiesManual.js --loan ${loanId} --backdate ${backdate} --reset`);
  console.log(hr());

  await sequelize.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
