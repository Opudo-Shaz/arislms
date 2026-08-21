// models/notificationOutboxModel.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');
const NotificationChannel = require('../enums/notificationChannel');
const NotificationDeliveryStatus = require('../enums/notificationDeliveryStatus');

// Persisted delivery queue. notificationDispatcher creates rows; outboxWorker
// (cron, see utils/cronRegistry) picks up QUEUED/retry-due rows and sends them
// via the matching channel adapter (services/notification/channels/*).
const NotificationOutbox = sequelize.define('NotificationOutbox', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  eventKey: { type: DataTypes.STRING(64), allowNull: false, field: 'event_key' },
  channel: { type: DataTypes.ENUM(Object.values(NotificationChannel)), allowNull: false },

  recipientUserId: { type: DataTypes.INTEGER, allowNull: true, field: 'recipient_user_id' },
  toAddress: { type: DataTypes.STRING(255), allowNull: true, field: 'to_address' },

  renderedSubject: { type: DataTypes.STRING(255), allowNull: true, field: 'rendered_subject' },
  renderedBody: { type: DataTypes.TEXT, allowNull: true, field: 'rendered_body' },

  status: {
    type: DataTypes.ENUM(Object.values(NotificationDeliveryStatus)),
    allowNull: false,
    defaultValue: NotificationDeliveryStatus.QUEUED,
  },
  attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  maxAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5, field: 'max_attempts' },
  lastError: { type: DataTypes.TEXT, allowNull: true, field: 'last_error' },
  nextAttemptAt: { type: DataTypes.DATE, allowNull: true, field: 'next_attempt_at' },

  relatedLoanId: { type: DataTypes.INTEGER, allowNull: true, field: 'related_loan_id' },
  relatedPaymentId: { type: DataTypes.INTEGER, allowNull: true, field: 'related_payment_id' },
  dedupeKey: { type: DataTypes.STRING(255), allowNull: true, field: 'dedupe_key' },
}, {
  tableName: 'notification_outbox',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['status', 'next_attempt_at'] },
    { fields: ['dedupe_key'] },
  ],
});

module.exports = NotificationOutbox;
