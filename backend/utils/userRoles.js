/**
 * Helpers for the many-to-many user <-> role relation (`user_roles`).
 * Queries go through the models directly (not associations) so they work
 * regardless of whether models/index.js has been loaded.
 */
const { Op } = require('sequelize');
const Role = require('../models/roleModel');
const UserRole = require('../models/userRoleModel');
const { LOAN_NOTIFICATIONS_RECEIVER } = require('../constants/roles');

/** Normalises any mix of numbers/numeric strings into a unique array of integers. */
const normalizeRoleIds = (ids) => {
  const list = Array.isArray(ids) ? ids : ids === undefined || ids === null ? [] : [ids];
  return [...new Set(list.map(Number).filter(Number.isInteger))];
};

async function getRoleIdsForUser(userId, options = {}) {
  const rows = await UserRole.findAll({ where: { userId }, attributes: ['roleId'], ...options });
  return rows.map((r) => r.roleId);
}

/** @returns {Promise<Map<number, number[]>>} userId -> roleIds */
async function getRoleIdsForUsers(userIds) {
  const map = new Map();
  if (!userIds.length) return map;
  const rows = await UserRole.findAll({ where: { userId: userIds }, attributes: ['userId', 'roleId'] });
  rows.forEach((r) => {
    if (!map.has(r.userId)) map.set(r.userId, []);
    map.get(r.userId).push(r.roleId);
  });
  return map;
}

/** Union of the permissions granted by every role in `roleIds`. */
async function getPermissionsForRoleIds(roleIds) {
  if (!roleIds.length) return [];
  const roles = await Role.findAll({ where: { id: roleIds }, attributes: ['permissions'] });
  return [...new Set(roles.flatMap((r) => (Array.isArray(r.permissions) ? r.permissions : [])))];
}

/** Replaces a user's roles with exactly `roleIds`. */
async function setUserRoles(userId, roleIds, transaction) {
  const ids = normalizeRoleIds(roleIds);
  await UserRole.destroy({ where: { userId, roleId: { [Op.notIn]: ids.length ? ids : [0] } }, transaction });
  const existing = await UserRole.findAll({ where: { userId }, attributes: ['roleId'], transaction });
  const have = new Set(existing.map((r) => r.roleId));
  const missing = ids.filter((id) => !have.has(id));
  if (missing.length) {
    await UserRole.bulkCreate(missing.map((roleId) => ({ userId, roleId })), { transaction });
  }
  return ids;
}

async function getLoanNotificationsReceiverRole() {
  return Role.findOne({ where: { name: LOAN_NOTIFICATIONS_RECEIVER } });
}

module.exports = {
  normalizeRoleIds,
  getRoleIdsForUser,
  getRoleIdsForUsers,
  getPermissionsForRoleIds,
  setUserRoles,
  getLoanNotificationsReceiverRole,
};
