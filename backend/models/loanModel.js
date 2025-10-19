const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');
const User = require('./userModel');

const Loan = sequelize.define('Loan', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  purpose: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  repayment_months: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  interest_rate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending',
  },
  guarantor_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  guarantor_phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  admin_comment: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  disbursed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  next_payment_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  monthly_payment: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'loans',
  timestamps: false,
});

User.hasMany(Loan, { foreignKey: 'user_id' });
Loan.belongsTo(User, { foreignKey: 'user_id' });

module.exports = Loan;
