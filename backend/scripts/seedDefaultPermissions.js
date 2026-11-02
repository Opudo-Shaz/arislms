/**
 * Seed script: assigns sensible default permission sets to the built-in roles.
 *
 *   Role 1 (Admin)   → ['*']  (wildcard super-bypass; handled implicitly in
 *                              auth too, but stored for visibility in the UI)
 *   Role 2 (Manager) → everything except the destructive/admin-only actions
 *                      (users:delete, roles:delete, users:reset_password,
 *                      system_config:reveal_secret, clients:manage_devices)
 *   Role 3 (Limited) → read-only permissions (every `*:read`)
 *
 * Also ensures the `loan_notifications_receiver` companion role exists (no
 * permissions — it only marks users who receive staff-side loan notifications).
 *
 * Only updates roles 1-3 that already exist. Safe to re-run — it overwrites the
 * permissions array for these three roles with the computed defaults.
 *
 * Usage:
 *   node backend/scripts/seedDefaultPermissions.js
 */

const Role = require('../models/roleModel');
const { ALL_PERMISSIONS } = require('../constants/permissions');
const { LOAN_NOTIFICATIONS_RECEIVER, LOAN_NOTIFICATIONS_RECEIVER_DESCRIPTION } = require('../constants/roles');

const MANAGER_EXCLUDED = ['users:delete', 'roles:delete', 'users:reset_password', 'system_config:reveal_secret', 'clients:manage_devices'];

const defaults = {
  1: ['*'],
  2: ALL_PERMISSIONS.filter((p) => !MANAGER_EXCLUDED.includes(p)),
  3: ALL_PERMISSIONS.filter((p) => p.endsWith(':read')),
};

async function seedDefaultPermissions() {
  const results = [];
  for (const [roleId, permissions] of Object.entries(defaults)) {
    const role = await Role.findByPk(Number(roleId));
    if (!role) {
      console.log(`  role ${roleId}: not found (skipped)`);
      results.push({ roleId: Number(roleId), status: 'skipped' });
      continue;
    }
    await role.update({ permissions });
    console.log(`  role ${roleId} (${role.name}): set ${permissions.length} permission(s)`);
    results.push({ roleId: Number(roleId), roleName: role.name, permissionCount: permissions.length, status: 'updated' });
  }

  const [receiver, created] = await Role.findOrCreate({
    where: { name: LOAN_NOTIFICATIONS_RECEIVER },
    defaults: { description: LOAN_NOTIFICATIONS_RECEIVER_DESCRIPTION, permissions: [], isActive: true },
  });
  console.log(`  role ${receiver.id} (${receiver.name}): ${created ? 'created' : 'already exists'}`);
  results.push({ roleId: receiver.id, roleName: receiver.name, status: created ? 'created' : 'exists' });

  return { results };
}

module.exports = seedDefaultPermissions;

// Allow standalone execution: node backend/scripts/seedDefaultPermissions.js
if (require.main === module) {
  const loadEnv = require('../config/env');
  loadEnv({ path: require('path').join(__dirname, '../.env') });
  const sequelize = require('../config/sequalize_db');

  (async () => {
    try {
      await sequelize.authenticate();
      console.log('DB connected.');
      await seedDefaultPermissions();
      console.log('Done.');
      await sequelize.close();
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}
