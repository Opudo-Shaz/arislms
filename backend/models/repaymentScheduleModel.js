const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');

const RepaymentSchedule = sequelize.define('RepaymentSchedule', {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true 
  },

  loanId: { 
    type: DataTypes.INTEGER, 
    allowNull: false, 
    field: 'loan_id',
    references: {
      model: 'loans',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },

  installmentNumber: { 
    type: DataTypes.INTEGER, 
    allowNull: false, 
    field: 'installment_number',
    comment: 'Sequential number of the installment (1, 2, 3...)'
  },

  dueDate: { 
    type: DataTypes.DATEONLY, 
    allowNull: false, 
    field: 'due_date',
    comment: 'Expected payment date for this installment'
  },

  principalAmount: { 
    type: DataTypes.DECIMAL(14,2), 
    allowNull: false, 
    field: 'principal_amount',
    comment: 'Principal portion of the installment'
  },

  interestAmount: { 
    type: DataTypes.DECIMAL(14,2), 
    allowNull: false, 
    field: 'interest_amount',
    comment: 'Interest portion of the installment'
  },

  feesAmount: {
    type: DataTypes.DECIMAL(14,2),
    allowNull: false,
    defaultValue: 0,
    field: 'fees_amount',
    comment: 'Fees portion of the installment (collected upfront at disbursement)'
  },

  totalAmount: { 
    type: DataTypes.DECIMAL(14,2), 
    allowNull: false, 
    field: 'total_amount',
    comment: 'Total amount due for this installment (principal + interest + fees)'
  },

  paidAmount: { 
    type: DataTypes.DECIMAL(14,2), 
    defaultValue: 0, 
    field: 'paid_amount',
    comment: 'Amount actually paid for this installment'
  },

  paidDate: { 
    type: DataTypes.DATEONLY, 
    field: 'paid_date',
    comment: 'Date when payment was made'
  },

  status: { 
    type: DataTypes.STRING(20), 
    allowNull: false, 
    defaultValue: 'pending',
    comment: 'Status: pending, paid, overdue, partial'
  },

  isMissed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_missed',
    comment: 'Whether this payment was missed (due date passed but not paid)'
  },

  penaltyAmount: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'penalty_amount',
    comment: 'Cumulative penalty charged against this installment'
  },

  penaltyPaid: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'penalty_paid',
    comment: 'Portion of penaltyAmount already collected via payments'
  },

  penaltyApplied: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'penalty_applied',
    comment: 'Idempotency flag: true once this installment has been charged a penalty by the cron'
  },

  remainingBalance: { 
    type: DataTypes.DECIMAL(14,2), 
    allowNull: false, 
    field: 'remaining_balance',
    comment: 'Outstanding loan balance after this installment'
  },

  notes: { 
    type: DataTypes.TEXT,
    comment: 'Additional notes about this installment'
  }

}, {
  tableName: 'repayment_schedules',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['loan_id', 'installment_number']
    },
    {
      fields: ['due_date']
    },
    {
      fields: ['status']
    }
  ]
});

module.exports = RepaymentSchedule;
