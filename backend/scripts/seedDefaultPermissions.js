/**
 * Seed script: assigns sensible default permission sets to the built-in roles.
 *
 *   Role 1 (Admin)   → ['*']  (wildcard super-bypass; handled implicitly in
 *                              auth too, but stored for visibility in the UI)
 *   Role 2 (Manager) → everything except the destructive/admin-only actions
 *                      (users:delete, roles:delete, users:reset_password)
 *   Role 3 (Limited) → read-only permissions (every `*:read`)
 *
 * Only updates roles that already exist. Safe to re-run — it overwrites the
 * permissions array for these three roles with the computed defaults.
 *
 * Usage:
 *   node backend/scripts/seedDefaultPermissions.js
 */

const loadEnv = require('../config/env');
loadEnv({ path: require('path').join(__dirname, '../.env') });

const sequelize = require('../config/sequalize_db');
const Role = require('../models/roleModel');
const { ALL_PERMISSIONS } = require('../constants/permissions');

const MANAGER_EXCLUDED = ['users:delete', 'roles:delete', 'users:reset_password', 'system_config:reveal_secret'];

const defaults = {
  1: ['*'],
  2: ALL_PERMISSIONS.filter((p) => !MANAGER_EXCLUDED.includes(p)),
  3: ALL_PERMISSIONS.filter((p) => p.endsWith(':read')),
};

async function seed() {
  await sequelize.authenticate();
  console.log('DB connected.');

  for (const [roleId, permissions] of Object.entries(defaults)) {
    const role = await Role.findByPk(Number(roleId));
    if (!role) {
      console.log(`  role ${roleId}: not found (skipped)`);
      continue;
    }
    await role.update({ permissions });
    console.log(`  role ${roleId} (${role.name}): set ${permissions.length} permission(s)`);
  }

  console.log('Done.');
  await sequelize.close();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
