const { DataTypes } = require('sequelize')
const sequelize = require('../config/sequalize_db')

const SystemConfig = sequelize.define('SystemConfig', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  // Machine-readable key (namespaced, e.g. 'storage.provider', 'loan.default_currency')
  key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },

  // Human-readable display name
  label: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },

  // The config value (always stored as text; caller parses if needed)
  value: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  // Grouping: 'storage' | 'notifications' | 'loans' | 'general' | 'integrations'
  category: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'general',
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  // For feature-flag configs (true = feature enabled)
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },

  // Boolean/feature-flag configs: isActive IS the value; string value not needed
  isBoolean: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_boolean',
  },

  // Read-only configs are seeded from env; the UI shows them but cannot edit them
  isReadOnly: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_read_only',
  },

  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'created_by',
  },
}, {
  tableName: 'system_configs',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})

module.exports = SystemConfig
