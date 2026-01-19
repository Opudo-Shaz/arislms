const User = require('../models/userModel');
const bcrypt = require('bcrypt');
const logger = require('../config/logger');
const AuditLogger = require('../utils/auditLogger');


const getAllUsers = async () => {
  return await User.findAll();
};

const getUserById = async (id) => {
  const user = await User.findByPk(id);
  if (!user) throw new Error('User not found');
  return user;
};

const createUser = async (data, creatorId = null, userAgent = 'unknown') => {
  try {
    const existingUser = await User.findOne({ where: { email: data.email } });
    if (existingUser) throw new Error('Email already exists');
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      data.password = await bcrypt.hash(data.password, salt);
    }

    const newUser = await User.create(data);

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
      data,
      actorId: creatorId || 'system',
      options: {
        actorType: 'USER',
        source: userAgent
      }
    });

    logger.info(`User created: id=${newUser.id} email=${newUser.email} by user ${creatorId}`);
    return newUser;
  } catch (error) {
    logger.error(`Error in createUser: ${error.message}`);
    throw error;
  }
};

const updateUser = async (id, data, updatorId = null, userAgent = 'unknown') => {
  try {
    const user = await User.findByPk(id);
    if (!user) throw new Error('User not found');

    const oldData = user.toJSON();
    await user.update(data);

    // Log to audit table after successful update
    await AuditLogger.log({
      entityType: 'USER',
      entityId: id,
      action: 'UPDATE',
      data: { changes: data },
      actorId: updatorId || 'system',
      options: {
        actorType: 'USER',
        source: userAgent
      }
    });

    logger.info(`User updated: id=${id} by user ${updatorId}`);
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

    const deletedData = user.toJSON();
    await user.destroy();

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

    logger.warn(`User deleted: id=${id} by user ${deletorId}`);
    return user;
  } catch (error) {
    logger.error(`Error in deleteUser (${id}): ${error.message}`);
    throw error;
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
