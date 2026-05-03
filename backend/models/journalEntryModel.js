const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');
const JournalEntryStatus = require('../enums/journalEntryStatus');

const JournalEntry = sequelize.define('JournalEntry', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },

  reference: {
    type: DataTypes.STRING(30),
    allowNull: false,
    comment: 'Human-readable reference e.g. JE-00001',
  },

  entryDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'entry_date',
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  status: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: JournalEntryStatus.POSTED,
    comment: 'DRAFT | POSTED | REVERSED',
  },

  sourceType: {
    type: DataTypes.STRING(30),
    allowNull: false,
    field: 'source_type',
    comment: 'LOAN_DISBURSEMENT | PAYMENT | CONTRIBUTION | MANUAL | FEE | EXPENSE | REVERSAL',
  },

  sourceId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'source_id',
    comment: 'FK to source record (loanId, paymentId, contributionId etc.)',
  },

  reversalOfId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'reversal_of_id',
    comment: 'If this entry is a reversal, points to the original JournalEntry id',
  },

  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'created_by',
  },
}, {
  tableName: 'journal_entries',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = JournalEntry;
