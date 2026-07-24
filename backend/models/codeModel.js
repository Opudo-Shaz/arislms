const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');

const Code = sequelize.define(
  'Code',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // Unique machine-readable key (e.g. 'GENDER', 'MARITAL_STATUS')
    key: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },

    // Human-readable display name
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
    },

    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'created_by',
    },

    modifiedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'modified_by',
    },

    modifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'modified_at',
    },
  },
  {
    tableName: 'c_codes',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = Code;
