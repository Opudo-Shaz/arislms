const User = require('../models/userModel');
const bcrypt = require('bcrypt');
const logger = require('../config/logger');
const AuditLogger = require('../utils/auditLogger');
const UserStatus = require('../enums/userStatus');
const { invalidateAuthUser } = require('../utils/authUserCache');
const sequelize = require('../config/sequalize_db');
const Role = require('../models/roleModel');
const UserRole = require('../models/userRoleModel');
const { hasWildcardPermission, roleIdsIncludeSuperAdmin } = require('../utils/permissionUtils');
const { normalizeRoleIds, getRoleIdsForUser, getRoleIdsForUsers, setUserRoles } = require('../utils/userRoles');
const { LOAN_NOTIFICATIONS_RECEIVER } = require('../constants/roles');

const buildFullName = (user) =>
  [user.first_name, user.middle_name, user.last_name]
    .filter(Boolean)
    .join(' ');



const badRequest = (message, status = 400) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

/** Attaches the user's role ids (non-persisted) so UserResponseDto can expose them. */
const withRoles = async (user) => {
  user.roleIds = await getRoleIdsForUser(user.id);
  return user;
};

/**
 * Pulls the requested role ids off the payload (accepts `roles` or legacy
 * single `role`) and removes both keys so they never reach User.create/update.
 * Returns undefined when the payload doesn't touch roles.
 */
const extractRoleIds = (data) => {
  const raw = data.roles !== undefined ? data.roles : data.role !== undefined ? [data.role] : undefined;
  delete data.roles;
  delete data.role;
  return raw === undefined ? undefined : normalizeRoleIds(raw);
};

/**
 * A user needs at least one role besides the companion
 * loan_notifications_receiver role, and every role must exist and be active.
 */
const validateRoleAssignment = async (roleIds) => {
  if (!roleIds.length) throw badRequest('At least one role is required');
  const roles = await Role.findAll({ where: { id: roleIds }, attributes: ['id', 'name', 'isActive'] });
  if (roles.length !== roleIds.length) throw badRequest('One or more roles do not exist');
  if (roles.some((r) => r.isActive === false)) throw badRequest('One or more roles are inactive');
  if (roles.every((r) => r.name === LOAN_NOTIFICATIONS_RECEIVER)) {
    throw badRequest(`"${LOAN_NOTIFICATIONS_RECEIVER}" must accompany a main role; assign at least one other role`);
  }
};

const getAllUsers = async () => {
  const users = await User.findAll();
  const roleMap = await getRoleIdsForUsers(users.map((u) => u.id));
  users.forEach((u) => { u.roleIds = roleMap.get(u.id) || []; });
  return users;
};

const getUserById = async (id) => {
  const user = await User.findByPk(id);
  if (!user) throw new Error('User not found');
  return withRoles(user);
};

const createUser = async (data, creatorId = null, userAgent = 'unknown', actorPermissions = [], options = {}) => {
  try {
    const existingEmail = await User.findOne({ where: { email: data.email } });
    if (existingEmail) throw new Error('Email already exists');

   
    if (data.id_number) {
      const existingIdNumber = await User.findOne({ where: { id_number: data.id_number } });
      if (existingIdNumber) throw new Error('ID number already exists');
    } else {
      data.id_number = null;
    }

    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      data.password = await bcrypt.hash(data.password, salt);
    }

    const roleIds = extractRoleIds(data);
    await validateRoleAssignment(roleIds || []);

    if (!options.skipSuperAdminGuard && (await roleIdsIncludeSuperAdmin(roleIds)) && !hasWildcardPermission(actorPermissions)) {
      const err = new Error('Only a Super Admin can create another Super Admin');
      err.status = 403;
      throw err;
    }

    if (creatorId) {
      data.createdBy = creatorId;
    }

    const newUser = await sequelize.transaction(async (transaction) => {
      const created = await User.create(data, { transaction });
      await setUserRoles(created.id, roleIds, transaction);
      return created;
    });
    newUser.roleIds = roleIds;

    // Validate the created user before logging
    if (!newUser || !newUser.id) {
      logger.error('User creation returned invalid result', { newUser });
      throw new Error('User creation failed: invalid user object returned');
    }

    // Log to audit table after successful creation
    await AuditLogger.log({
      entityType: 'USER',
      entityId: newUser.id,
      action: 'CREATE',
      data: { ...data, roles: roleIds },
      actorId: creatorId || 'system',
      options: {
        actorType: 'USER',
        source: userAgent
      }
    });

    logger.info(`User created: id=${newUser.id} email=${newUser.email} by user ${creatorId}`);
    return newUser;
  } catch (error) {
    if (error.errors) {
      // Sequelize ValidationError / UniqueConstraintError — log each violation
      const details = error.errors.map(e => `${e.path}: ${e.message}`).join(', ');
      logger.error(`Error in createUser: ${error.message} — ${details}`);
    } else {
      logger.error(`Error in createUser: ${error.message}`);
    }
    throw error;
  }
};

const updateUser = async (id, data, updatorId = null, userAgent = 'unknown', actorPermissions = []) => {
  try {
    const user = await User.findByPk(id);
    if (!user) throw new Error('User not found');

  // Hash password if being updated
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      data.password = await bcrypt.hash(data.password, salt);
    }

    const roleIds = extractRoleIds(data);
    const currentRoleIds = await getRoleIdsForUser(user.id);

    const rolesChanged =
      roleIds !== undefined &&
      (roleIds.length !== currentRoleIds.length || roleIds.some((r) => !currentRoleIds.includes(r)));

    if (roleIds !== undefined) {
      await validateRoleAssignment(roleIds);
    }

    if (rolesChanged && !hasWildcardPermission(actorPermissions)) {
      const [targetHasSuperAdmin, currentHasSuperAdmin] = await Promise.all([
        roleIdsIncludeSuperAdmin(roleIds),
        roleIdsIncludeSuperAdmin(currentRoleIds),
      ]);
      if (targetHasSuperAdmin || currentHasSuperAdmin) {
        const err = new Error("Only a Super Admin can change another Super Admin's role");
        err.status = 403;
        throw err;
      }
    }

    await sequelize.transaction(async (transaction) => {
      await user.update(data, { transaction });
      if (rolesChanged) await setUserRoles(user.id, roleIds, transaction);
    });
    user.roleIds = rolesChanged ? roleIds : currentRoleIds;
    if (rolesChanged) invalidateAuthUser(user.id);


    // Log to audit table after successful update
    await AuditLogger.log({
      entityType: 'USER',
      entityId: id,
      action: 'UPDATE',
      data: { changes: rolesChanged ? { ...data, roles: roleIds } : data },
      actorId: updatorId || 'system',
      options: {
        actorType: 'USER',
        source: userAgent
      }
    });

  logger.info(
    `User updated: id=${user.id} name=${buildFullName(user)} by user ${updatorId}`
  );
    return user;
  } catch (error) {
    logger.error(`Error in updateUser (${id}): ${error.message}`);
    throw error;
  }
};

const deleteUser = async (id, deletorId = null, userAgent = 'unknown') => {
  try {
    if (!id) throw new Error('User ID is required');
    if (isNaN(id)) throw new Error('User ID must be a number');
    const user = await User.findByPk(id);
    if (!user) throw new Error('User not found');

    await withRoles(user);
    const deletedData = { ...user.toJSON(), roles: user.roleIds };
    await sequelize.transaction(async (transaction) => {
      await UserRole.destroy({ where: { userId: user.id }, transaction });
      await user.destroy({ transaction });
    });

    invalidateAuthUser(id);

    // Log to audit table after successful deletion
    await AuditLogger.log({
      entityType: 'USER',
      entityId: id,
      action: 'DELETE',
      data: deletedData,
      actorId: deletorId || 'system',
      options: {
        actorType: 'USER',
        source: userAgent
      }
    });

  logger.warn(
    `User deleted: id=${id} name=${buildFullName(user)} by user ${deletorId}`
  );
    return user;
  } catch (error) {
    logger.error(`Error in deleteUser (${id}): ${error.message}`);
    throw error;
  }
};

const updateUserStatus = async (id, status, actorId = null, userAgent = 'unknown') => {
  try {
    if (!Object.values(UserStatus).includes(status)) {
      const err = new Error(`Invalid status. Must be one of: ${Object.values(UserStatus).join(', ')}`);
      err.status = 400;
      throw err;
    }

    const user = await User.findByPk(id);
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }

    if (actorId && Number(actorId) === Number(id)) {
      const err = new Error('You cannot change your own status');
      err.status = 400;
      throw err;
    }

    const previousStatus = user.status;
    
    await user.update({ status, token_version: user.token_version + 1 });
    invalidateAuthUser(id);

    await AuditLogger.log({
      entityType: 'USER',
      entityId: id,
      action: 'UPDATE',
      data: { statusChanged: { from: previousStatus, to: status } },
      actorId: actorId || 'system',
      options: {
        actorType: 'USER',
        source: userAgent
      }
    });

    logger.info(
      `User status updated: id=${id} name=${buildFullName(user)} ${previousStatus} -> ${status} by user ${actorId}`
    );
    return withRoles(user);
  } catch (error) {
    logger.error(`Error in updateUserStatus (${id}): ${error.message}`);
    throw error;
  }
};

const resetUserPassword = async (userId, email, newPassword, actorId = null, userAgent = 'unknown') => {
  try {
    const user = await User.findOne({ where: { id: userId, email } });
    if (!user) {
      const err = new Error('User not found or email does not match');
      err.status = 404;
      throw err;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    // Invalidate any tokens issued before this reset.
    await user.update({ password: hashedPassword, token_version: user.token_version + 1 });
    invalidateAuthUser(userId);

    await AuditLogger.log({
      entityType: 'USER',
      entityId: userId,
      action: 'RESET_PASSWORD',
      data: { email, resetBy: actorId },
      actorId: actorId || 'system',
      options: {
        actorType: 'USER',
        source: userAgent
      }
    });

    logger.warn(`Password reset for user id=${userId} (${email}) by actor ${actorId}`);
    return withRoles(user);
  } catch (error) {
    logger.error(`Error in resetUserPassword (${userId}): ${error.message}`);
    throw error;
  }
};

const changeOwnPassword = async (userId, currentPassword, newPassword, userAgent = 'unknown') => {
  const user = await User.findByPk(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) {
    const err = new Error('Current password is incorrect');
    err.status = 400;
    throw err;
  }

  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(newPassword, salt);
  
  await user.update({ password: hashed, token_version: user.token_version + 1 });
  invalidateAuthUser(userId);

  await AuditLogger.log({
    entityType: 'USER',
    entityId: userId,
    action: 'UPDATE',
    data: { passwordChanged: true },
    actorId: userId,
    options: { actorType: 'USER', source: userAgent },
  });

  logger.info(`User ${userId} changed own password`);
  return user;
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateUserStatus,
  resetUserPassword,
  changeOwnPassword,
};
