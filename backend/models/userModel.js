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

    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
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

    // ✅ Single source of truth for role
    role_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
    },

    password: {
    type: DataTypes.STRING(255),
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

// ✅ Associations
User.belongsTo(Role, {
  foreignKey: 'role_id',
  as: 'role',
});

Role.hasMany(User, {
  foreignKey: 'role_id',
  as: 'users',
});

module.exports = User;
