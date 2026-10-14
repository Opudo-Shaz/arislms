/**
 * Migration: denormalised co-signer consent status on loans (the
 * co_signer_consents table itself is created by sequelize.sync).
 * NULL = no consent tracking (no co-signer, or a loan created before this feature).
 * Run once: node scripts/addCoSignerConsentStatusToLoans.js
 */

const sequelize = require('../config/sequalize_db');

async function run() {
  await sequelize.authenticate();
  await sequelize.query(`
    ALTER TABLE loans
    ADD COLUMN IF NOT EXISTS co_signer_consent_status VARCHAR(16) NULL;
  `);
  console.log('Migration complete: co_signer_consent_status added to loans.');
  await sequelize.close();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
