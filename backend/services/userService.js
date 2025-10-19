const User = require('../models/userModel');
const bcrypt = require('bcrypt');


const getAllUsers = async () => {
  return await User.findAll();
};

const getUserById = async (id) => {
  const user = await User.findByPk(id);
  if (!user) throw new Error('User not found');
  return user;
};

const createUser = async (data) => {
  const existingUser = await User.findOne({ where: { email: data.email } });
  if (existingUser) throw new Error('Email already exists');
  if (data.password) {
    const salt = await bcrypt.genSalt(10);
    data.password = await bcrypt.hash(data.password, salt);
  }

  return await User.create(data);
};

const updateUser = async (id, data) => {
  const user = await User.findByPk(id);
  if (!user) throw new Error('User not found');

  await user.update(data);
  return user;
};

const deleteUser = async (id) => {
    if (!id) throw new Error('User ID is required');
    if (isNaN(id)) throw new Error('User ID must be a number');
    const user = await User.findByPk(id);
    if (!user) throw new Error('User not found');

  await user.destroy();
  return user;
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
