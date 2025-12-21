const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');
const InterestType = require('../enums/interestType');

const LoanProduct = sequelize.define('LoanProduct', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  description: { type: DataTypes.TEXT },

  // Interest settings
  interestRate: { type: DataTypes.DECIMAL(5,2), allowNull: false },
  interestType: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: InterestType.FIXED
  },

  penaltyRate: { type: DataTypes.DECIMAL(5,2), defaultValue: 0 },

  // Loan rules
  minimumDownPayment: { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  repaymentPeriodMonths: { type: DataTypes.INTEGER, allowNull: false },

  maxLoanAmount: { type: DataTypes.DECIMAL(14,2), defaultValue: null },
  minLoanAmount: { type: DataTypes.DECIMAL(14,2), defaultValue: null },

  fees: {
    type: DataTypes.DECIMAL(14,2),
    defaultValue: 0
  },

  currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'KES' },
  createdBy: { type: DataTypes.INTEGER, allowNull: false, field: 'created_by' },

  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },

}, {
  tableName: 'loan_products',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = LoanProduct;
