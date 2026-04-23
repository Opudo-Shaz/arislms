/**
 * One-time migration: changes audit_log.actor_id from VARCHAR to INTEGER.
 *
 * PostgreSQL cannot auto-cast text → integer, so sequelize.sync({ alter: true })
 * fails. This script uses an explicit USING clause to do the conversion.
 *
 * Run ONCE before starting the server:
 *   node backend/scripts/migrateAuditActorId.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const sequelize = require('../config/sequalize_db');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Check current column type first
    const [rows] = await sequelize.query(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name = 'audit_log' AND column_name = 'actor_id';
    `);

    if (!rows.length) {
      console.log('Column actor_id not found — nothing to migrate.');
      process.exit(0);
    }

    const currentType = rows[0].data_type;
    console.log(`Current actor_id type: ${currentType}`);

    if (currentType === 'integer') {
      console.log('actor_id is already INTEGER — no migration needed.');
      process.exit(0);
    }

    // Cast existing values to integer. Since the table was truncated this is
    // safe; if there were rows with non-numeric values this would fail — which
    // is the correct behaviour (don't silently lose data).
    await sequelize.query(`
      ALTER TABLE audit_log
        ALTER COLUMN actor_id TYPE INTEGER USING actor_id::INTEGER;
    `);

    console.log('Migration complete: actor_id is now INTEGER.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
