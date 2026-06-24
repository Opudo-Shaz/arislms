const userService = require('../services/userService');
const logger = require('../config/logger');
const { validateSync } = require('../utils/validationMiddleware');
const { getUserId, getUserFullName } = require('../utils/helpers');
const UserResponseDto = require('../dtos/user/UserResponseDto');
const UserRequestDto = require('../dtos/user/UserRequestDto');

// Get all users
const getUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    logger.info(`Fetched ${users.length} users`);

    const result = users.map(u => new UserResponseDto(u));
    res.json(result);

  } catch (err) {
    logger.error(`Error fetching users: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

// Get single user by ID
const getUser = async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);

    if (!user) {
      logger.warn(`User with ID ${req.params.id} not found`);
      return res.status(404).json({ message: 'User not found' });
    }

    logger.info(`Fetched user with ID ${req.params.id}`);
    res.json(new UserResponseDto(user));

  } catch (err) {
    logger.error(`Error fetching user ${req.params.id}: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

// Create new user
const createUser = async (req, res) => {
  try {
    const userId = getUserId(req);
    const userAgent = req.headers['user-agent'];

    const validation = validateSync(req.body, UserRequestDto.createSchema);
    console.log('CREATE USER PAYLOAD:', req.body);

    if (!validation.valid) {
      logger.warn(`User creation validation failed: ${JSON.stringify(validation.errors)}`);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validation.errors
      });
    }

    const newUser = await userService.createUser(validation.value, userId, userAgent);

    const fullName = getUserFullName(newUser.first_name, newUser.middle_name, newUser.last_name);

    logger.info(`Created new user: ${fullName} (ID: ${newUser.id})`);

    res.status(201).json(new UserResponseDto(newUser));

  } catch (err) {
    logger.error(`Error creating user: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
};


// Update existing user
const updateUser = async (req, res) => {
  try {
    const userId = getUserId(req);
    const userAgent = req.headers['user-agent'];
    const actorRole = req.user?.role;
    const targetId = Number(req.params.id);

    // Role 3 (limited) may only update their OWN record with restricted fields.
    if (actorRole === 3) {
      if (userId !== targetId) {
        return res.status(403).json({ success: false, message: 'Access denied: you can only update your own profile' });
      }
      const validation = validateSync(req.body, UserRequestDto.selfUpdateSchema);
      if (!validation.valid) {
        logger.warn(`Self-update validation failed: ${JSON.stringify(validation.errors)}`);
        return res.status(400).json({ success: false, message: 'Validation error', errors: validation.errors });
      }
      const updated = await userService.updateUser(targetId, validation.value, userId, userAgent);
      if (!updated) return res.status(404).json({ message: 'User not found' });
      logger.info(`User ${userId} updated own profile`);
      return res.json(new UserResponseDto(updated));
    }

    // Admin / manager: full update schema
    const validation = validateSync(req.body, UserRequestDto.updateSchema);
    if (!validation.valid) {
      logger.warn(`User update validation failed: ${JSON.stringify(validation.errors)}`);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validation.errors
      });
    }

    const updated = await userService.updateUser(targetId, validation.value, userId, userAgent);

    if (!updated) {
      logger.warn(`User with ID ${targetId} not found`);
      return res.status(404).json({ message: 'User not found' });
    }

    logger.info(`Updated user with ID ${targetId}`);
    res.json(new UserResponseDto(updated));

  } catch (err) {
    logger.error(`Error updating user ${req.params.id}: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const userId = getUserId(req);
    const userAgent = req.headers['user-agent'];

    const deleted = await userService.deleteUser(req.params.id, userId, userAgent);

    if (!deleted) {
      logger.warn(`User with ID ${req.params.id} not found`);
      return res.status(404).json({ message: 'User not found' });
    }

    logger.info(`Deleted user with ID ${req.params.id}`);
    res.json({
      message: 'User deleted',
      user: new UserResponseDto(deleted)
    });

  } catch (err) {
    logger.error(`Error deleting user ${req.params.id}: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

// Reset a user's password — super admin only (role 1)
const resetUserPassword = async (req, res) => {
  try {
    const actorId = getUserId(req);
    const userAgent = req.headers['user-agent'];

    const validation = validateSync(req.body, UserRequestDto.resetPasswordSchema);
    if (!validation.valid) {
      logger.warn(`Password reset validation failed: ${JSON.stringify(validation.errors)}`);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validation.errors
      });
    }

    const { userId, email, newPassword } = validation.value;

    const user = await userService.resetUserPassword(userId, email, newPassword, actorId, userAgent);

    logger.info(`Password reset for user id=${userId} by actor ${actorId}`);
    res.json({
      success: true,
      message: 'Password reset successfully',
      user: new UserResponseDto(user)
    });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ message: err.message });
    }
    logger.error(`Error resetting password: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

// Change own password — any authenticated user
const changeOwnPassword = async (req, res) => {
  try {
    const userId = getUserId(req);
    const userAgent = req.headers['user-agent'];

    const validation = validateSync(req.body, UserRequestDto.changePasswordSchema);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: validation.errors });
    }

    const { currentPassword, newPassword } = validation.value;
    await userService.changeOwnPassword(userId, currentPassword, newPassword, userAgent);

    logger.info(`User ${userId} changed own password`);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    const status = err.status || 500;
    logger.error(`Error changing password: ${err.message}`);
    res.status(status).json({ success: false, message: err.message });
  }
};

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  changeOwnPassword,
};
