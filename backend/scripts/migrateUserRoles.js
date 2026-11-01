/**
 * Migration: multi-role users.
 *  - creates `user_roles` (user_id, role_id) and backfills it from users.role_id
 *  - drops users.role_id
 *  - user_invitations: role_id -> role_ids (JSONB array)
 *  - creates the `loan_notifications_receiver` companion role
 *
 * Idempotent. MUST be run before the server boots on an existing database:
 * server.js uses sequelize.sync({ alter: true }), which would otherwise drop
 * users.role_id before it has been copied into user_roles.
 *
 * Run once: node scripts/migrateUserRoles.js
 */

const loadEnv = require('../config/env');
loadEnv({ path: require('path').join(__dirname, '../.env') });

const sequelize = require('../config/sequalize_db');
const Role = require('../models/roleModel');
const {
  LOAN_NOTIFICATIONS_RECEIVER,
  LOAN_NOTIFICATIONS_RECEIVER_DESCRIPTION,
} = require('../constants/roles');

async function columnExists(table, column) {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = :table AND column_name = :column`,
    { replacements: { table, column } }
  );
  return rows.length > 0;
}

async function migrateUserRoles() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id    INTEGER     NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, role_id)
    );
  `);
  await sequelize.query('CREATE INDEX IF NOT EXISTS user_roles_role_id ON user_roles (role_id);');

  if (await columnExists('users', 'role_id')) {
    await sequelize.query(`
      INSERT INTO user_roles (user_id, role_id)
      SELECT id, role_id FROM users WHERE role_id IS NOT NULL
      ON CONFLICT DO NOTHING;
    `);
    await sequelize.query('ALTER TABLE users DROP COLUMN role_id;');
    console.log('  users.role_id backfilled into user_roles and dropped');
  }

  await sequelize.query(`
    ALTER TABLE user_invitations
      ADD COLUMN IF NOT EXISTS role_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);
  if (await columnExists('user_invitations', 'role_id')) {
    await sequelize.query(`
      UPDATE user_invitations
      SET role_ids = jsonb_build_array(role_id)
      WHERE role_id IS NOT NULL AND role_ids = '[]'::jsonb;
    `);
    await sequelize.query('ALTER TABLE user_invitations DROP COLUMN role_id;');
    console.log('  user_invitations.role_id converted to role_ids and dropped');
  }

  const [role, created] = await Role.findOrCreate({
    where: { name: LOAN_NOTIFICATIONS_RECEIVER },
    defaults: { description: LOAN_NOTIFICATIONS_RECEIVER_DESCRIPTION, permissions: [], isActive: true },
  });
  console.log(`  role "${role.name}" (id ${role.id}) ${created ? 'created' : 'already exists'}`);
}

module.exports = migrateUserRoles;

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await migrateUserRoles();
      console.log('Migration complete: multi-role users.');
      await sequelize.close();
    } catch (err) {
      console.error('Migration failed:', err);
      process.exit(1);
    }
  })();
}
