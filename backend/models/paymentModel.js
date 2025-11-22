const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');
const Loan = require('./loanModel');
const User = require('./userModel');

const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  loanId: { type: DataTypes.INTEGER, allowNull: false, field: 'loan_id' },
  amount: { type: DataTypes.DECIMAL(14,2), allowNull: false },
  currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'KES' },
  paymentMethod: { type: DataTypes.STRING(32), field: 'payment_method' },
  externalRef: { type: DataTypes.STRING(128), unique: true, field: 'external_ref' },
  payerName: { type: DataTypes.STRING(128), field: 'payer_name' },
  payerPhone: { type: DataTypes.STRING(32), field: 'payer_phone' },
  transactionDate: { type: DataTypes.DATE, allowNull: true, field: 'transaction_date' },
  paymentDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'payment_date' },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'completed' },
  appliedToPrincipal: { type: DataTypes.DECIMAL(14,2), field: 'applied_to_principal', defaultValue: 0 },
  appliedToInterest: { type: DataTypes.DECIMAL(14,2), field: 'applied_to_interest', defaultValue: 0 },
  fees: { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  penalties: { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  processedBy: { type: DataTypes.INTEGER, field: 'processed_by' },
  notes: { type: DataTypes.TEXT },
}, {
  tableName: 'payments',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Associations
Payment.belongsTo(Loan, { foreignKey: 'loan_id' });
Loan.hasMany(Payment, { foreignKey: 'loan_id' });

Payment.belongsTo(User, { foreignKey: 'processed_by' });
User.hasMany(Payment, { foreignKey: 'processed_by' });

module.exports = Payment;
