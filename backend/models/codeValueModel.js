const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');

const CodeValue = sequelize.define(
  'CodeValue',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    codeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'code_id',
    },

    // Stored/machine value (validated on submit, e.g. 'male')
    value: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'sort_order',
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
    tableName: 'c_code_values',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['code_id', 'value'],
        name: 'c_code_values_code_id_value_unique',
      },
    ],
  }
);

module.exports = CodeValue;
