/**
 * Migration: add is_secret column to system_configs table.
 *
 * Usage (from repo root):
 *   node backend/scripts/addIsSecretToSystemConfigs.js
 */

const loadEnv = require('../config/env');
loadEnv({ path: require('path').join(__dirname, '../.env') });

const sequelize = require('../config/sequalize_db');

async function run() {
  await sequelize.authenticate();
  console.log('DB connected.');

  await sequelize.query(`
    ALTER TABLE system_configs
      ADD COLUMN IF NOT EXISTS is_secret BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  // Mark the Gmail App Password row as secret (if it already exists)
  await sequelize.query(`
    UPDATE system_configs SET is_secret = TRUE
    WHERE key = 'email.provider.gmail.pass';
  `);

  console.log('Done: is_secret column added and gmail.pass row marked.');
  await sequelize.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
