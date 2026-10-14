const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');
const PaymentReportStatus = require('../enums/paymentReportStatus');

// A repayment the client says they made manually (e.g. M-Pesa paybill) and
// reported through the self-service portal. Staff review it, may amend the
// details, then apply it — which records a real Payment via paymentService —
// or reject it. Temporary until direct M-Pesa integration.
const PaymentReport = sequelize.define('PaymentReport', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  clientId: { type: DataTypes.INTEGER, allowNull: false, field: 'client_id' },
  loanId: { type: DataTypes.INTEGER, allowNull: false, field: 'loan_id' },
  amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'KES' },
  transactionDate: { type: DataTypes.DATE, allowNull: false, field: 'transaction_date' },
  paymentMethod: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'MPESA', field: 'payment_method' },
  externalRef: { type: DataTypes.STRING(128), allowNull: false, field: 'external_ref' },
  payerPhone: { type: DataTypes.STRING(32), field: 'payer_phone' },
  notes: { type: DataTypes.TEXT },
  status: {
    type: DataTypes.ENUM(Object.values(PaymentReportStatus)),
    allowNull: false,
    defaultValue: PaymentReportStatus.PENDING,
  },
  // The client's values exactly as submitted, kept so staff amendments stay traceable.
  originalSubmission: { type: DataTypes.JSONB, allowNull: false, field: 'original_submission' },
  reviewedBy: { type: DataTypes.INTEGER, field: 'reviewed_by' },
  reviewedAt: { type: DataTypes.DATE, field: 'reviewed_at' },
  reviewNotes: { type: DataTypes.TEXT, field: 'review_notes' },
  paymentId: { type: DataTypes.INTEGER, field: 'payment_id' },
}, {
  tableName: 'payment_reports',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['client_id'] },
    { fields: ['status'] },
    { fields: ['external_ref'] },
  ],
});

module.exports = PaymentReport;
