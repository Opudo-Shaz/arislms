const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');

// Links a dropdown-backed SystemConfig row to the Code that supplies its
// selectable values (one code per config; the actual chosen value string is
// still stored on system_configs.value).
const SystemConfigCodeRelation = sequelize.define(
  'SystemConfigCodeRelation',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    systemConfigId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      field: 'system_config_id',
    },

    codeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'code_id',
    },
  },
  {
    tableName: 'system_config_code_relations',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = SystemConfigCodeRelation;
