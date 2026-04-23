const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');

const JournalEntryLine = sequelize.define('JournalEntryLine', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },

  journalEntryId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'journal_entry_id',
  },

  accountId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'account_id',
  },

  debit: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0.00,
  },

  credit: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0.00,
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  // Optional links — these turn this table into a subsidiary ledger
  loanId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'loan_id',
  },

  clientId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'client_id',
    comment: 'Links line to a member/borrower (Client)',
  },
}, {
  tableName: 'journal_entry_lines',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = JournalEntryLine;
