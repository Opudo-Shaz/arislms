const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');

const CreditScore = sequelize.define('CreditScore', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  clientId: { 
    type: DataTypes.INTEGER, 
    allowNull: true, 
    field: 'client_id',
    comment: 'Client ID - can be standalone or associated with a loan'
  },

  loanId: { 
    type: DataTypes.INTEGER, 
    allowNull: true, 
    field: 'loan_id',
    comment: 'Loan ID - optional, useful for loan-specific credit evaluation'
  },

  riskScore: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'risk_score',
    comment: 'Credit risk score (0-100)'
  },

  riskGrade: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'risk_grade',
    comment: 'Risk grade: A, B, C, D, E, F'
  },

  riskDti: {
    type: DataTypes.FLOAT,
    allowNull: true,
    field: 'risk_dti',
    comment: 'Debt-to-Income ratio'
  },

  scoringBreakdown: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'scoring_breakdown',
    comment: 'Detailed breakdown of scoring factors'
  },

  scoringModelVersion: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'scoring_model_version',
    comment: 'Version of the scoring model used'
  },

  evaluatedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'evaluated_by',
    comment: 'User ID who evaluated the credit score'
  },

  creditLimit: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: true,
    field: 'credit_limit',
    comment: 'Computed credit limit based on income band and risk score'
  },

  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'notes'
  },

}, {
  tableName: 'credit_scores',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = CreditScore;
