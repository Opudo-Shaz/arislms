/**
 * Master permission list for the Roles & Permissions module.
 *
 * Naming convention: `{resource}:{action}` (all lowercase).
 * These strings are stored in the `roles.permissions` JSONB column and checked
 * by `requirePermission()` in authMiddleware. The frontend mirrors this list
 * (frontend/src/constants/enums.js) to build the RoleForm picker — the picker is
 * the sole guard against invalid permission strings.
 *
 * Admin (role id 1) bypasses these via the wildcard `['*']` and never needs an
 * explicit entry here.
 */

const PERMISSIONS = Object.freeze({
  CLIENTS: {
    READ: 'clients:read',
    CREATE: 'clients:create',
    UPDATE: 'clients:update',
    DELETE: 'clients:delete',
  },
  LOANS: {
    READ: 'loans:read',
    CREATE: 'loans:create',
    UPDATE: 'loans:update',
    DELETE: 'loans:delete',
    APPROVE: 'loans:approve',
    REJECT: 'loans:reject',
    DISBURSE: 'loans:disburse',
    WRITE_OFF: 'loans:write_off',
  },
  PAYMENTS: {
    READ: 'payments:read',
    CREATE: 'payments:create',
    DELETE: 'payments:delete',
  },
  LOAN_PRODUCTS: {
    READ: 'loan_products:read',
    CREATE: 'loan_products:create',
    UPDATE: 'loan_products:update',
    DELETE: 'loan_products:delete',
  },
  COLLATERALS: {
    READ: 'collaterals:read',
    CREATE: 'collaterals:create',
    UPDATE: 'collaterals:update',
    DELETE: 'collaterals:delete',
    UPDATE_STATUS: 'collaterals:update_status',
  },
  CREDIT_SCORES: {
    READ: 'credit_scores:read',
    CREATE: 'credit_scores:create',
  },
  ACCOUNTING: {
    READ: 'accounting:read',
    CREATE: 'accounting:create',
    UPDATE: 'accounting:update',
    DELETE: 'accounting:delete',
    POST_ENTRY: 'accounting:post_entry',
    REVERSE_ENTRY: 'accounting:reverse_entry',
  },
  CONTRIBUTIONS: {
    READ: 'contributions:read',
    CREATE: 'contributions:create',
    UPDATE: 'contributions:update',
    DELETE: 'contributions:delete',
  },
  REPORTS: {
    READ: 'reports:read',
  },
  USERS: {
    READ: 'users:read',
    CREATE: 'users:create',
    UPDATE: 'users:update',
    DELETE: 'users:delete',
    RESET_PASSWORD: 'users:reset_password',
    UPDATE_STATUS: 'users:update_status',
  },
  ROLES: {
    READ: 'roles:read',
    CREATE: 'roles:create',
    UPDATE: 'roles:update',
    DELETE: 'roles:delete',
  },
  INVITATIONS: {
    READ: 'invitations:read',
    CREATE: 'invitations:create',
    UPDATE: 'invitations:update',
    DELETE: 'invitations:delete',
  },
  NOTIFICATIONS: {
    READ: 'notifications:read',
    MANAGE_TEMPLATES: 'notifications:manage_templates',
    MANAGE_OUTBOX: 'notifications:manage_outbox',
  },
  DOCUMENTS: {
    READ: 'documents:read',
    CREATE: 'documents:create',
    UPDATE: 'documents:update',
    DELETE: 'documents:delete',
  },
  CODES: {
    READ: 'codes:read',
    CREATE: 'codes:create',
    UPDATE: 'codes:update',
    DELETE: 'codes:delete',
  },
  SYSTEM_CONFIG: {
    READ: 'system_config:read',
    CREATE: 'system_config:create',
    UPDATE: 'system_config:update',
    DELETE: 'system_config:delete',
    REVEAL_SECRET: 'system_config:reveal_secret',
  },
  CRON: {
    READ: 'cron:read',
    MANAGE: 'cron:manage',
  },
  AUDITS: {
    READ: 'audits:read',
  },
});

/**
 * Flat array of every permission string. Used by the seed script and mirrored on
 * the frontend for the picker.
 */
const ALL_PERMISSIONS = Object.freeze(
  Object.values(PERMISSIONS).flatMap((group) => Object.values(group))
);

module.exports = { PERMISSIONS, ALL_PERMISSIONS };
