/**
 * Migration: client self-service portal support.
 *  - clients: token_version / portal_enabled / last_login_at (client sessions)
 *  - otps: client_id (OTPs can belong to a client instead of a staff user)
 *  - loans: source ('staff' | 'portal')
 *  - audit_logs: allow actor_type 'CLIENT' — only if the table has a DB-level
 *    CHECK on actor_type (tables created by scripts/initAuditTable.js). Tables
 *    created by sequelize.sync have no CHECK (the model's isIn is app-level),
 *    so nothing is added there.
 * Run once: node scripts/addClientPortalAuth.js
 */

const sequelize = require('../config/sequalize_db');

async function run() {
  await sequelize.authenticate();
  await sequelize.query(`
    ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NULL;
  `);
  await sequelize.query(`
    ALTER TABLE otps
      ADD COLUMN IF NOT EXISTS client_id INTEGER NULL;
    ALTER TABLE otps ALTER COLUMN user_id DROP NOT NULL;
    CREATE INDEX IF NOT EXISTS otps_client_id_purpose ON otps (client_id, purpose);
  `);
  await sequelize.query(`
    ALTER TABLE loans
      ADD COLUMN IF NOT EXISTS source VARCHAR(16) NOT NULL DEFAULT 'staff';
  `);
  const [checks] = await sequelize.query(`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'audit_logs'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%actor_type%';
  `);
  for (const { conname } of checks) {
    await sequelize.query(`ALTER TABLE audit_logs DROP CONSTRAINT "${conname}";`);
  }
  if (checks.length) {
    await sequelize.query(`
      ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_actor_type_check
        CHECK (actor_type IN ('USER', 'SERVICE', 'SYSTEM', 'CLIENT'));
    `);
  }
  console.log('Migration complete: client portal auth columns added.');
  await sequelize.close();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
