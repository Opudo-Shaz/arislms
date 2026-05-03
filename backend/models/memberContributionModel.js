const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');
const ContributionType = require('../enums/contributionType');

const MemberContribution = sequelize.define('MemberContribution', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },

  clientId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'client_id',
    comment: 'Members are tracked as Clients',
  },

  amount: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
  },

  contributionDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'contribution_date',
  },

  type: {
    type: DataTypes.STRING(12),
    allowNull: false,
    defaultValue: ContributionType.CONTRIBUTION,
    comment: 'CONTRIBUTION | WITHDRAWAL',
  },

  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  journalEntryId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'journal_entry_id',
    comment: 'The auto-posted journal entry for this record',
  },

  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'created_by',
  },
}, {
  tableName: 'member_contributions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = MemberContribution;
