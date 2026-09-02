/**
 * Helpers for identifying the "Super Admin" role by its permissions rather
 * than a hardcoded numeric role id. The Admin role's id is not guaranteed to
 * be `1` in every environment (re-seeded databases, staging vs prod, etc.),
 * so "is this a Super Admin role" must be derived from data: by convention
 * the Super Admin role is whichever role has the wildcard `'*'` permission
 * (see backend/scripts/seedDefaultPermissions.js).
 */
const Role = require('../models/roleModel');

/** True if a resolved permissions array grants the wildcard super-admin bypass. */
const hasWildcardPermission = (permissions) =>
  Array.isArray(permissions) && permissions.includes('*');

/**
 * Looks up a role by id and reports whether it carries the wildcard
 * permission. Returns false for a missing/null roleId or a role that
 * doesn't exist.
 * @param {number|null|undefined} roleId
 */
async function roleIdIsSuperAdmin(roleId) {
  if (roleId === undefined || roleId === null) return false;
  const role = await Role.findByPk(roleId, { attributes: ['permissions'] });
  return hasWildcardPermission(role?.permissions);
}

module.exports = { hasWildcardPermission, roleIdIsSuperAdmin };
