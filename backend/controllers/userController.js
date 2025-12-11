const userService = require('../services/userService');
const logger = require('../config/logger');
const { validateSync } = require('../utils/validationMiddleware');
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
    // Validate request payload with Joi schema
    const validation = validateSync(req.body, UserRequestDto.createSchema);
    if (!validation.valid) {
      logger.warn(`User creation validation failed: ${JSON.stringify(validation.errors)}`);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validation.errors
      });
    }

    const newUser = await userService.createUser(validation.value);
    logger.info(`Created new user: ${newUser.name} (ID: ${newUser.id})`);

    res.status(201).json(new UserResponseDto(newUser));

  } catch (err) {
    logger.error(`Error creating user: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
};

// Update existing user
const updateUser = async (req, res) => {
  try {
    // Validate request payload with Joi schema
    const validation = validateSync(req.body, UserRequestDto.updateSchema);
    if (!validation.valid) {
      logger.warn(`User update validation failed: ${JSON.stringify(validation.errors)}`);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validation.errors
      });
    }

    const updated = await userService.updateUser(req.params.id, validation.value);

    if (!updated) {
      logger.warn(`User with ID ${req.params.id} not found`);
      return res.status(404).json({ message: 'User not found' });
    }

    logger.info(`Updated user with ID ${req.params.id}`);
    res.json(new UserResponseDto(updated));

  } catch (err) {
    logger.error(`Error updating user ${req.params.id}: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const deleted = await userService.deleteUser(req.params.id);

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

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
};
