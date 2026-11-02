/**
 * Migration: device-bound portal login.
 *  - otps.device_hash: the device that requested a login code (only it can redeem it)
 *  - client_devices: devices a client has proven themselves on (OTP + national-ID step-up)
 *  - clients.step_up_*: per-client brute-force counter for the national-ID step-up
 * Run once: node scripts/addClientDeviceBinding.js
 */

const sequelize = require('../config/sequalize_db');

async function run() {
  await sequelize.authenticate();
  await sequelize.query(`
    ALTER TABLE otps ADD COLUMN IF NOT EXISTS device_hash VARCHAR(64) NULL;
  `);
  await sequelize.query(`
    ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS step_up_failed_attempts INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS step_up_last_failed_at TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS step_up_locked_until TIMESTAMPTZ NULL;
  `);
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS client_devices (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      device_hash VARCHAR(64) NOT NULL,
      user_agent VARCHAR(255) NULL,
      last_ip VARCHAR(64) NULL,
      trusted_at TIMESTAMPTZ NOT NULL,
      last_seen_at TIMESTAMPTZ NULL,
      revoked_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS client_devices_client_id_device_hash
      ON client_devices (client_id, device_hash);
  `);
  console.log('Migration complete: device binding columns/tables added.');
  await sequelize.close();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
