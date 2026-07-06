/**
 * Migration: add requires_co_signer column to loan_products table.
 * Run once: node scripts/addRequiresCoSignerToLoanProducts.js
 */

const sequelize = require('../config/sequalize_db');

async function run() {
  await sequelize.authenticate();
  await sequelize.query(`
    ALTER TABLE loan_products
    ADD COLUMN IF NOT EXISTS requires_co_signer BOOLEAN NOT NULL DEFAULT FALSE;
  `);
  console.log('Migration complete: requires_co_signer added to loan_products.');
  await sequelize.close();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
