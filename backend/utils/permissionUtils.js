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
const UserRole = require('../models/userRoleModel');
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
 * True if ANY of the given role ids carries the wildcard permission.
 * @param {Array<number>} roleIds
 */
async function roleIdsIncludeSuperAdmin(roleIds) {
  const ids = (roleIds || []).filter((id) => id !== undefined && id !== null);
  if (!ids.length) return false;
  const roles = await Role.findAll({ where: { id: ids }, attributes: ['permissions'] });
  return roles.some((r) => hasWildcardPermission(r.permissions));
}

/**
 * Active staff users with a role that grants `permission` (explicitly or via the
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

  const links = await UserRole.findAll({
    where: { roleId: roles.map((r) => r.id) },
    attributes: ['userId'],
  });
  const userIds = [...new Set(links.map((l) => l.userId))];
  if (!userIds.length) return [];

  const users = await User.findAll({
    where: { id: userIds, status: UserStatus.ACTIVE },
    attributes: ['id', 'email'],
  });
  return users.map((u) => ({ userId: u.id, ...(u.email ? { email: u.email } : {}) }));
}

module.exports = { hasWildcardPermission, roleIdIsSuperAdmin, roleIdsIncludeSuperAdmin, getActiveUsersWithPermission };
