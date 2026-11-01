const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');

/** Join table: a user can hold several roles (e.g. a main role + loan_notifications_receiver). */
const UserRole = sequelize.define(
  'UserRole',
  {
    userId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      field: 'user_id',
    },
    roleId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      field: 'role_id',
    },
  },
  {
    tableName: 'user_roles',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  }
);

module.exports = UserRole;
