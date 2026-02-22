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

  totalAmount: { 
    type: DataTypes.DECIMAL(14,2), 
    allowNull: false, 
    field: 'total_amount',
    comment: 'Total amount due for this installment (principal + interest)'
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
