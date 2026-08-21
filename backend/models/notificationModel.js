// models/notificationModel.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');
const User = require('./userModel');
const Loan = require('./loanModel');
const Payment = require('./paymentModel');
const NotificationChannel = require('../enums/notificationChannel');

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  title: { type: DataTypes.STRING(100), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  type: { 
    type: DataTypes.ENUM('info', 'loan', 'payment', 'warning', 'reminder'), 
    defaultValue: 'info' 
  },
  channel: {
    type: DataTypes.ENUM(Object.values(NotificationChannel)),
    allowNull: false,
    defaultValue: NotificationChannel.IN_APP,
  },
  eventKey: { type: DataTypes.STRING(64), allowNull: true, field: 'event_key' },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_read' },
  relatedLoanId: { type: DataTypes.INTEGER, field: 'related_loan_id', allowNull: true },
  relatedPaymentId: { type: DataTypes.INTEGER, field: 'related_payment_id', allowNull: true },
}, {
  tableName: 'notifications',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

// Associations
Notification.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(Notification, { foreignKey: 'user_id' });

Notification.belongsTo(Loan, { foreignKey: 'related_loan_id', allowNull: true });
Notification.belongsTo(Payment, { foreignKey: 'related_payment_id', allowNull: true });

module.exports = Notification;
