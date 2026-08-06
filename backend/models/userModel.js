const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');
const Role = require('./roleModel');
const UserStatus = require('../enums/userStatus');

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

    status: {
      type: DataTypes.ENUM(Object.values(UserStatus)),
      allowNull: false,
      defaultValue: UserStatus.ACTIVE,
      field: 'status',
    },

    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'created_by',
    },

    token_version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'token_version',
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
