const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');
const User = require('./userModel');
const LoanProduct = require('./loanProductModel');
const Client = require('./clientModel');
const InterestType = require('../enums/interestType');
const RepaymentSchedule = require('./repaymentScheduleModel');

const Loan = sequelize.define('Loan', {

  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  clientId: { type: DataTypes.INTEGER, allowNull: false, field: 'client_id' },

  loanProductId: { 
    type: DataTypes.INTEGER, 
    allowNull: false, 
    field: 'loan_product_id' 
  },

  principalAmount: { type: DataTypes.DECIMAL(14,2), allowNull: false, field: 'principal_amount' },
  currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'USD' },

  interestRate: { type: DataTypes.DECIMAL(6,4), allowNull: false, field: 'interest_rate' },
  interestType: { type: DataTypes.STRING, allowNull: true, defaultValue: InterestType.FIXED, field: 'interest_type' },

  termMonths: { type: DataTypes.INTEGER, allowNull: false, field: 'term_months' },

  paymentFrequency: { 
    type: DataTypes.STRING(20), 
    allowNull: false, 
    defaultValue: 'monthly', 
    field: 'payment_frequency',
    comment: 'Payment frequency: monthly, bi-weekly, weekly, quarterly'
  },

  startDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'start_date' },
  endDate: { type: DataTypes.DATEONLY, field: 'end_date' },

  disbursementDate: { 
    type: DataTypes.DATEONLY, 
    field: 'disbursement_date',
    comment: 'Date when loan was actually disbursed to client'
  },
  
  nextPaymentDate: { 
    type: DataTypes.DATEONLY, 
    field: 'next_payment_date',
    comment: 'Next expected payment date'
  },

  paymentSchedule: { 
    type: DataTypes.JSONB, 
    field: 'payment_schedule',
    comment: 'Deprecated: Use RepaymentSchedule model instead'
  },
  installmentAmount: { type: DataTypes.DECIMAL(14,2), field: 'installment_amount' },

  outstandingBalance: { type: DataTypes.DECIMAL(14,2), allowNull: false, field: 'outstanding_balance' },

  amountRepaid: { type: DataTypes.DOUBLE, field: 'amount_repaid', defaultValue: 0 },
  noOfRepayments: { type: DataTypes.INTEGER, defaultValue: 0, field: 'no_of_repayments' },

  fees: { type: DataTypes.DECIMAL(14,2), defaultValue: 0, field: 'fees' },
  penalties: { type: DataTypes.DECIMAL(14,2), defaultValue: 0, field: 'penalties' },

  collateral: { type: DataTypes.JSONB },
  coSignerId: { type: DataTypes.INTEGER, field: 'co_signer_id' },

  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },

  referenceCode: { type: DataTypes.STRING, unique: true, field: 'reference_code' },
  notes: { type: DataTypes.TEXT },

  createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },

  updatedAt: { type: DataTypes.DATE, allowNull: true, field: 'updated_at' },

}, {
  tableName: 'loans',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
});

// Associations
User.hasMany(Loan, { foreignKey: 'created_by' });
Loan.belongsTo(User, { foreignKey: 'created_by' });

Client.hasMany(Loan, { foreignKey: 'client_id' });
Loan.belongsTo(User, { foreignKey: 'client_id' });

LoanProduct.hasMany(Loan, { foreignKey: 'loan_product_id' });
Loan.belongsTo(LoanProduct, { foreignKey: 'loan_product_id' });

Loan.hasMany(RepaymentSchedule, { foreignKey: 'loan_id', as: 'repaymentSchedules' });
RepaymentSchedule.belongsTo(Loan, { foreignKey: 'loan_id' });

module.exports = Loan;
