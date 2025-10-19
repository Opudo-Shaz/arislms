const userService = require('../services/userService');
const logger = require('../config/logger'); 

// Get all users
const getUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    logger.info(`Fetched ${users.length} users`);
    res.json(users);
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
    res.json(user);
  } catch (err) {
    logger.error(`Error fetching user ${req.params.id}: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

// Create new user
const createUser = async (req, res) => {
  try {
    const newUser = await userService.createUser(req.body);
    logger.info(`Created new user: ${newUser.name} (ID: ${newUser.id})`);
    res.status(201).json(newUser);
  } catch (err) {
    logger.error(`Error creating user: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
};

// Update existing user
const updateUser = async (req, res) => {
  try {
    const updated = await userService.updateUser(req.params.id, req.body);
    if (!updated) {
      logger.warn(`Update failed — user with ID ${req.params.id} not found`);
      return res.status(404).json({ message: 'User not found' });
    }
    logger.info(`Updated user with ID ${req.params.id}`);
    res.json(updated);
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
      logger.warn(`Delete failed — user with ID ${req.params.id} not found`);
      return res.status(404).json({ message: 'User not found' });
    }
    logger.info(`Deleted user with ID ${req.params.id}`);
    res.json({ message: 'User deleted', user: deleted });
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
