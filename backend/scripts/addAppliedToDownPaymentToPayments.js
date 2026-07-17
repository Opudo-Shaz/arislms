/**
 * Migration: add applied_to_down_payment column to payments table.
 * Run once: node scripts/addAppliedToDownPaymentToPayments.js
 */

const sequelize = require('../config/sequalize_db');

async function run() {
  await sequelize.authenticate();
  await sequelize.query(`
    ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS applied_to_down_payment DECIMAL(14,2) NOT NULL DEFAULT 0;
  `);
  console.log('Migration complete: applied_to_down_payment added to payments.');
  await sequelize.close();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
