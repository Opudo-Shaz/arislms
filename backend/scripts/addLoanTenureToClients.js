/**
 * Migration: add loan_tenure column to clients table.
 * Tracks a client's loan-completion loyalty counter used by the credit scorer's
 * previous-score blend weight. Run once: node scripts/addLoanTenureToClients.js
 */

const sequelize = require('../config/sequalize_db');

async function run() {
  await sequelize.authenticate();
  await sequelize.query(`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS loan_tenure INTEGER NOT NULL DEFAULT 0;
  `);
  console.log('Migration complete: loan_tenure added to clients.');
  await sequelize.close();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
