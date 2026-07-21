/**
 * Migration: create password_reset_tokens table.
 *
 * Usage (from repo root):
 *   node backend/scripts/createPasswordResetTokensTable.js
 */

const loadEnv = require('../config/env');
loadEnv({ path: require('path').join(__dirname, '../.env') });

const sequelize = require('../config/sequalize_db');

async function run() {
  await sequelize.authenticate();
  console.log('DB connected.');

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash   VARCHAR(64) NOT NULL UNIQUE,
      expires_at   TIMESTAMPTZ NOT NULL,
      used_at      TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_prt_user_id    ON password_reset_tokens (user_id);
    CREATE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens (token_hash);
    CREATE INDEX IF NOT EXISTS idx_prt_expires_at ON password_reset_tokens (expires_at);
  `);

  console.log('password_reset_tokens table created (or already exists).');
  await sequelize.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
