const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');
const SmsMessageStatus = require('../enums/smsMessageStatus');

// One row per SMS handed to a gateway. Tracks the gateway-side delivery state
// (updated by delivery webhooks) separately from notification_outbox.status,
// which only says whether the gateway accepted the message. The message body is
// deliberately not stored (it may contain OTP codes).
const SmsMessage = sequelize.define('SmsMessage', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  provider: { type: DataTypes.STRING(32), allowNull: false },
  // Single sends: known immediately. Bulk sends: filled in by the first webhook.
  providerMessageId: { type: DataTypes.STRING(64), allowNull: true, field: 'provider_message_id' },
  batchId: { type: DataTypes.STRING(64), allowNull: true, field: 'batch_id' },
  recipient: { type: DataTypes.STRING(32), allowNull: false },
  status: {
    type: DataTypes.ENUM(Object.values(SmsMessageStatus)),
    allowNull: false,
    defaultValue: SmsMessageStatus.SUBMITTED,
  },
  parts: { type: DataTypes.INTEGER, allowNull: true },
  cost: { type: DataTypes.DECIMAL(12, 4), allowNull: true },
  failureReason: { type: DataTypes.TEXT, allowNull: true, field: 'failure_reason' },
  sentAt: { type: DataTypes.DATE, allowNull: true, field: 'sent_at' },
  deliveredAt: { type: DataTypes.DATE, allowNull: true, field: 'delivered_at' },
  failedAt: { type: DataTypes.DATE, allowNull: true, field: 'failed_at' },
  outboxId: { type: DataTypes.INTEGER, allowNull: true, field: 'outbox_id' },
}, {
  tableName: 'sms_messages',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['provider', 'provider_message_id'] },
    { fields: ['provider', 'batch_id', 'recipient'] },
    { fields: ['outbox_id'] },
  ],
});

module.exports = SmsMessage;
