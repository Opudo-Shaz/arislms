const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');
const User = require('./userModel');


const Loan = sequelize.define('Loan', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  clientId: { type: DataTypes.INTEGER, allowNull: false, field: 'client_id' },
  principalAmount: { type: DataTypes.DECIMAL(14,2), allowNull: false, field: 'principal_amount' },
  currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'USD' },
  interestRate: { type: DataTypes.DECIMAL(6,4), allowNull: false, field: 'interest_rate' },
  interestType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'reducing', field: 'interest_type' },
  termMonths: { type: DataTypes.INTEGER, allowNull: false, field: 'term_months' },
  startDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'start_date' },
  endDate: { type: DataTypes.DATEONLY, field: 'end_date' },
  paymentSchedule: { type: DataTypes.JSONB, field: 'payment_schedule' },
  installmentAmount: { type: DataTypes.DECIMAL(14,2), field: 'installment_amount' },
  outstandingBalance: { type: DataTypes.DECIMAL(14,2), allowNull: false, field: 'outstanding_balance' },
  totalPayments: { type: DataTypes.INTEGER, field: 'total_payments' },
  paymentsMade: { type: DataTypes.INTEGER, defaultValue: 0, field: 'payments_made' },
  fees: { type: DataTypes.DECIMAL(14,2), defaultValue: 0, field: 'fees' },
  penalties: { type: DataTypes.DECIMAL(14,2), defaultValue: 0, field: 'penalties' },
  collateral: { type: DataTypes.JSONB },
  coSignerId: { type: DataTypes.INTEGER, field: 'co_signer_id' },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
  referenceCode: { type: DataTypes.STRING, unique: true, field: 'reference_code' },
  notes: { type: DataTypes.TEXT },
  paidAt: { type: DataTypes.DATE, field: 'paid_at' },
  createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
  defaultedAt: { type: DataTypes.DATE, field: 'defaulted_at' },
  cancelledAt: { type: DataTypes.DATE, field: 'cancelled_at' },
}, {
  tableName: 'loans',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});
User.hasMany(Loan, { foreignKey: 'user_id' });
Loan.belongsTo(User, { foreignKey: 'user_id' });

module.exports = Loan;
