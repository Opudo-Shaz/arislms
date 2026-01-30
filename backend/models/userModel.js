const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');
const Role = require('./roleModel');

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    first_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    middle_name: {
      type: DataTypes.STRING(100),
      allowNull: true, // optional
    },

    last_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },

    id_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    role_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'role_id',
    },

    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'created_by',
    },

    updatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'updated_at',
    },
  },
  {
    tableName: 'users',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    freezeTableName: true,
  }
);

module.exports = User;
