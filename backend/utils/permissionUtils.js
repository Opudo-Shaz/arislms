/**
 * Helpers for identifying the "Super Admin" role by its permissions rather
 * than a hardcoded numeric role id. The Admin role's id is not guaranteed to
 * be `1` in every environment (re-seeded databases, staging vs prod, etc.),
 * so "is this a Super Admin role" must be derived from data: by convention
 * the Super Admin role is whichever role has the wildcard `'*'` permission
 * (see backend/scripts/seedDefaultPermissions.js).
 */
const { Op } = require('sequelize');
const Role = require('../models/roleModel');
const User = require('../models/userModel');
const UserStatus = require('../enums/userStatus');

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

/**
 * Active staff users whose role grants `permission` (explicitly or via the
 * wildcard), shaped as notificationDispatcher recipients. Used to alert
 * whoever can act on a queue item (e.g. `loans:approve`) without hardcoding roles.
 * @param {string} permission e.g. 'loans:approve'
 * @returns {Promise<Array<{userId: number, email?: string}>>}
 */
async function getActiveUsersWithPermission(permission) {
  const roles = await Role.findAll({
    where: {
      isActive: true,
      [Op.or]: [
        { permissions: { [Op.contains]: [permission] } },
        { permissions: { [Op.contains]: ['*'] } },
      ],
    },
    attributes: ['id'],
  });
  if (!roles.length) return [];

  const users = await User.findAll({
    where: { role_id: roles.map((r) => r.id), status: UserStatus.ACTIVE },
    attributes: ['id', 'email'],
  });
  return users.map((u) => ({ userId: u.id, ...(u.email ? { email: u.email } : {}) }));
}

module.exports = { hasWildcardPermission, roleIdIsSuperAdmin, getActiveUsersWithPermission };
