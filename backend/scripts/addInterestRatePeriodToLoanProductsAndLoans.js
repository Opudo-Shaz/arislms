/**
 * Migration: add interest_rate_period column to loan_products and loans tables.
 * Run once: node scripts/addInterestRatePeriodToLoanProductsAndLoans.js
 */

const sequelize = require('../config/sequalize_db');

async function run() {
  await sequelize.authenticate();
  await sequelize.query(`
    ALTER TABLE loan_products
    ADD COLUMN IF NOT EXISTS interest_rate_period VARCHAR(20) NOT NULL DEFAULT 'annual';
  `);
  await sequelize.query(`
    ALTER TABLE loans
    ADD COLUMN IF NOT EXISTS interest_rate_period VARCHAR(20) NOT NULL DEFAULT 'annual';
  `);
  console.log('Migration complete: interest_rate_period added to loan_products and loans.');
  await sequelize.close();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
