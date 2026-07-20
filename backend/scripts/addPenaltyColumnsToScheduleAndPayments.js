/**
 * Migration: add penalty tracking columns
 *
 * repayment_schedules:
 *   penalty_amount   DECIMAL(14,2) NOT NULL DEFAULT 0
 *   penalty_paid     DECIMAL(14,2) NOT NULL DEFAULT 0
 *   penalty_applied  BOOLEAN       NOT NULL DEFAULT false
 *
 * payments:
 *   applied_to_penalty DECIMAL(14,2) NOT NULL DEFAULT 0
 *
 * Safe to run multiple times (uses IF NOT EXISTS / column-exists check).
 */

const sequelize = require('../config/sequalize_db');
const logger = require('../config/logger');

async function columnExists(queryInterface, table, column) {
  const tableDesc = await queryInterface.describeTable(table);
  return Object.prototype.hasOwnProperty.call(tableDesc, column);
}

async function run() {
  const qi = sequelize.getQueryInterface();

  await sequelize.authenticate();
  logger.info('[Migration] DB connected');

  // ── repayment_schedules ──────────────────────────────────────────────────────
  const scheduleColumns = [
    {
      column: 'penalty_amount',
      def: { type: sequelize.Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    },
    {
      column: 'penalty_paid',
      def: { type: sequelize.Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    },
    {
      column: 'penalty_applied',
      def: { type: sequelize.Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    },
  ];

  for (const { column, def } of scheduleColumns) {
    if (await columnExists(qi, 'repayment_schedules', column)) {
      logger.info(`[Migration] repayment_schedules.${column} already exists — skipped`);
    } else {
      await qi.addColumn('repayment_schedules', column, def);
      logger.info(`[Migration] Added repayment_schedules.${column}`);
    }
  }

  // ── payments ─────────────────────────────────────────────────────────────────
  if (await columnExists(qi, 'payments', 'applied_to_penalty')) {
    logger.info('[Migration] payments.applied_to_penalty already exists — skipped');
  } else {
    await qi.addColumn('payments', 'applied_to_penalty', {
      type: sequelize.Sequelize.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    });
    logger.info('[Migration] Added payments.applied_to_penalty');
  }

  logger.info('[Migration] Done');
  await sequelize.close();
}

run().catch((err) => {
  logger.error(`[Migration] Failed: ${err.message}`);
  process.exit(1);
});
