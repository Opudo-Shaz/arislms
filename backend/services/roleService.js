const Role = require('../models/roleModel');
const UserRole = require('../models/userRoleModel');
const { LOAN_NOTIFICATIONS_RECEIVER } = require('../constants/roles');
const AuditLogger = require('../utils/auditLogger');
const { invalidateAuthUser } = require('../utils/authUserCache');
const logger = require('../config/logger');

/**
 * Evict the cached auth entry for every user carrying the given role so that a
 * permission change on that role takes effect immediately rather than waiting
 * out the auth cache TTL.
 * @param {Number} roleId
 */
async function invalidateRoleUsers(roleId) {
  try {
    const users = await UserRole.findAll({
      where: { roleId },
      attributes: ['userId'],
    });
    users.forEach((u) => invalidateAuthUser(u.userId));
    if (users.length) {
      logger.info(`Auth cache invalidated for ${users.length} user(s) of role ${roleId}`);
    }
  } catch (error) {
    logger.error(`RoleService.invalidateRoleUsers Error: ${error.message}`);
  }
}

const systemRoleError = (message) => {
  const err = new Error(message);
  err.status = 400;
  return err;
};

const roleService = {

  async createRole(data, creatorId = null, userAgent = 'unknown') {
    try {
      data.createdBy = creatorId;
      const newRole = await Role.create(data);

      // Validate the created role before logging
      if (!newRole || !newRole.id) {
        logger.error('Role creation returned invalid result', { newRole });
        throw new Error('Role creation failed: invalid role object returned');
      }

      // Log to audit table after successful creation
      await AuditLogger.log({
        entityType: 'ROLE',
        entityId: newRole.id,
        action: 'CREATE',
        data,
        actorId: creatorId || 1,
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      logger.info(`Role created: id=${newRole.id} name=${newRole.name} by user ${creatorId}`);
      return newRole;
    } catch (error) {
      logger.error(`RoleService.createRole Error: ${error.message}`);
      throw error;
    }
  },

  /** * Get all roles   */
  async getAllRoles() {
    try {
      const roles = await Role.findAll();
      logger.info('Retrieved all roles');
      return roles;
    } catch (error) {
      logger.error(`RoleService.getAllRoles Error: ${error.message}`);
      throw error;
    }
  },

  /**
   * Get role by ID
   * @param {Number} id - Role ID
   * @returns {Promise<Object>} Role object
   */
  async getRoleById(id) {
    try {
      const role = await Role.findByPk(id);
      if (!role) throw new Error('Role not found');
      logger.info(`Retrieved role ID: ${id}`);
      return role;
    } catch (error) {
      logger.error(`RoleService.getRoleById Error: ${error.message}`);
      throw error;
    }
  },

  /**
   * Get role by name
   * @param {string} name - Role name
   * @returns {Promise<Object>} Role object
   */
  async getRoleByName(name) {
    try {
      const role = await Role.findOne({ where: { name } });
      if (!role) throw new Error('Role not found');
      logger.info(`Retrieved role by name: ${name}`);
      return role;
    } catch (error) {
      logger.error(`RoleService.getRoleByName Error: ${error.message}`);
      throw error;
    }
  },

  /**
   * Update role
   * @param {Number} id - Role ID
   * @param {Object} data - Updated role data
   * @param {Number} updatorId - ID of the user updating the role
   * @param {string} userAgent - User agent for audit logging
   * @returns {Promise<Object>} Updated role
   */
  async updateRole(id, data, updatorId = null, userAgent = 'unknown') {
    try {
      const role = await Role.findByPk(id);
      if (!role) throw new Error('Role not found');

      if (role.name === LOAN_NOTIFICATIONS_RECEIVER && data.name && data.name !== role.name) {
        throw systemRoleError(`The "${LOAN_NOTIFICATIONS_RECEIVER}" system role cannot be renamed`);
      }

      await role.update(data);

      // Log to audit table after successful update
      await AuditLogger.log({
        entityType: 'ROLE',
        entityId: id,
        action: 'UPDATE',
        data: { changes: data },
        actorId: updatorId || 1,
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      // Permission set may have changed — refresh affected users' auth cache.
      await invalidateRoleUsers(id);

      logger.info(`Role updated: id=${id} by user ${updatorId}`);
      return role;
    } catch (error) {
      logger.error(`RoleService.updateRole Error: ${error.message}`);
      throw error;
    }
  },

  /**
   * Add permission to role
   * @param {Number} id - Role ID
   * @param {string} permission - Permission to add
   * @param {Number} updatorId - ID of the user updating the role
   * @param {string} userAgent - User agent for audit logging
   * @returns {Promise<Object>} Updated role
   */
  async addPermission(id, permission, updatorId = null, userAgent = 'unknown') {
    try {
      const role = await Role.findByPk(id);
      if (!role) throw new Error('Role not found');

      const permissions = role.permissions || [];
      if (!permissions.includes(permission)) {
        permissions.push(permission);
        await role.update({ permissions });

        // Log to audit table after successful update
        await AuditLogger.log({
          entityType: 'ROLE',
          entityId: id,
          action: 'UPDATE',
          data: { action: 'add_permission', permission },
          actorId: updatorId || 1,
          options: {
            actorType: 'USER',
            source: userAgent
          }
        });

        // Refresh affected users' auth cache so the new permission applies now.
        await invalidateRoleUsers(id);

        logger.info(`Permission ${permission} added to role ${id} by user ${updatorId}`);
      }
      return role;
    } catch (error) {
      logger.error(`RoleService.addPermission Error: ${error.message}`);
      throw error;
    }
  },

  /**
   * Remove permission from role
   * @param {Number} id - Role ID
   * @param {string} permission - Permission to remove
   * @param {Number} updatorId - ID of the user updating the role
   * @param {string} userAgent - User agent for audit logging
   * @returns {Promise<Object>} Updated role
   */
  async removePermission(id, permission, updatorId = null, userAgent = 'unknown') {
    try {
      const role = await Role.findByPk(id);
      if (!role) throw new Error('Role not found');

      const permissions = role.permissions || [];
      const index = permissions.indexOf(permission);
      if (index > -1) {
        permissions.splice(index, 1);
        await role.update({ permissions });

        // Log to audit table after successful update
        await AuditLogger.log({
          entityType: 'ROLE',
          entityId: id,
          action: 'UPDATE',
          data: { action: 'remove_permission', permission },
          actorId: updatorId || 1,
          options: {
            actorType: 'USER',
            source: userAgent
          }
        });

        // Refresh affected users' auth cache so the removal applies now.
        await invalidateRoleUsers(id);

        logger.info(`Permission ${permission} removed from role ${id} by user ${updatorId}`);
      }
      return role;
    } catch (error) {
      logger.error(`RoleService.removePermission Error: ${error.message}`);
      throw error;
    }
  },

  /**
   * Delete role
   * @param {Number} id - Role ID
   * @param {Number} deletorId - ID of the user deleting the role
   * @param {string} userAgent - User agent for audit logging
   * @returns {Promise<Object>} Deletion result
   */
  async deleteRole(id, deletorId = null, userAgent = 'unknown') {
    try {
      const role = await Role.findByPk(id);
      if (!role) throw new Error('Role not found');

      if (role.name === LOAN_NOTIFICATIONS_RECEIVER) {
        throw systemRoleError(`The "${LOAN_NOTIFICATIONS_RECEIVER}" system role cannot be deleted`);
      }
      const assigned = await UserRole.count({ where: { roleId: id } });
      if (assigned > 0) {
        throw systemRoleError(`Role is assigned to ${assigned} user(s); reassign them before deleting it`);
      }

      const deletedData = role.toJSON();
      await role.destroy();

      // Log to audit table after successful deletion
      await AuditLogger.log({
        entityType: 'ROLE',
        entityId: id,
        action: 'DELETE',
        data: deletedData,
        actorId: deletorId || 1,
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      logger.warn(`Role deleted: id=${id} by user ${deletorId}`);
      return { message: 'Role deleted successfully', id };
    } catch (error) {
      logger.error(`RoleService.deleteRole Error: ${error.message}`);
      throw error;
    }
  },
};

module.exports = roleService;
