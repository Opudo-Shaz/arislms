/**
 * seederRegistry
 *
 * Static registry of the one-off seed scripts under backend/scripts/ that are
 * safe to re-run against a live database (all use findOrCreate / upsert-style
 * logic — see each script's header comment). Lets a Super Admin trigger them
 * from the admin UI/API instead of needing shell access to the production
 * server (see backend/controllers/seederController.js).
 *
 * Each script exports a reusable async function (no `sequelize.close()` /
 * `process.exit()` inside it — those only run under the script's own
 * `require.main === module` CLI guard) so it's safe to call in-process here.
 */

const SEEDERS = {
  'default-permissions': {
    key: 'default-permissions',
    name: 'Default Role Permissions',
    description: 'Assigns the default permission sets to the built-in roles (Admin/Manager/Limited).',
    fn: require('../scripts/seedDefaultPermissions'),
  },
  'system-config': {
    key: 'system-config',
    name: 'System Config Defaults',
    description: 'Inserts default system configuration entries (storage, email, loans, notifications).',
    fn: require('../scripts/seedSystemConfig'),
  },
  codes: {
    key: 'codes',
    name: 'Config Codes',
    description: 'Inserts example config codes and values (gender, marital status, etc.).',
    fn: require('../scripts/seedCodes'),
  },
  'chart-of-accounts': {
    key: 'chart-of-accounts',
    name: 'Chart of Accounts',
    description: 'Populates the default chart of accounts for the savings-group lending system.',
    fn: require('../scripts/seedChartOfAccounts'),
  },
  'notification-templates': {
    key: 'notification-templates',
    name: 'Notification Templates',
    description: 'Inserts default NotificationTemplate rows for core lifecycle events.',
    fn: require('../scripts/seedNotificationTemplates'),
  },
};

/** List all registered seeders (metadata only, no handler functions). */
function list() {
  return Object.values(SEEDERS).map(({ key, name, description }) => ({ key, name, description }));
}

/** Get a registered seeder by key, or undefined if not found. */
function get(key) {
  return SEEDERS[key];
}

module.exports = { list, get };
