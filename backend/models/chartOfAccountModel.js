const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');

const ChartOfAccount = sequelize.define('ChartOfAccount', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },

  code: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'Account code e.g. 1001',
  },

  name: {
    type: DataTypes.STRING(120),
    allowNull: false,
  },

  type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'account_type',
    comment: 'ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE',
  },

  normalBalance: {
    type: DataTypes.STRING(6),
    allowNull: false,
    field: 'normal_balance',
    comment: 'DEBIT for assets/expenses, CREDIT for liabilities/equity/revenue',
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active',
  },

  parentAccountId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'parent_account_id',
    comment: 'Self-reference for sub-accounts',
  },

  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'created_by',
  },
}, {
  tableName: 'chart_of_accounts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = ChartOfAccount;
