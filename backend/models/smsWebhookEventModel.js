const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');

// Log of verified delivery webhooks received from SMS gateways. The unique
// (provider, delivery_id) pair makes gateway retries idempotent; rows that
// matched no sms_messages row yet (webhook beat the DB insert) stay unmatched
// and are re-applied once the message row is recorded.
const SmsWebhookEvent = sequelize.define('SmsWebhookEvent', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  provider: { type: DataTypes.STRING(32), allowNull: false },
  deliveryId: { type: DataTypes.STRING(64), allowNull: false, field: 'delivery_id' },
  event: { type: DataTypes.STRING(32), allowNull: false },
  providerMessageId: { type: DataTypes.STRING(64), allowNull: true, field: 'provider_message_id' },
  batchId: { type: DataTypes.STRING(64), allowNull: true, field: 'batch_id' },
  recipient: { type: DataTypes.STRING(32), allowNull: true },
  payload: { type: DataTypes.JSONB, allowNull: false },
  eventTimestamp: { type: DataTypes.DATE, allowNull: true, field: 'event_timestamp' },
  matched: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'sms_webhook_events',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['provider', 'delivery_id'] },
    { fields: ['matched', 'provider_message_id'] },
    { fields: ['matched', 'batch_id'] },
  ],
});

module.exports = SmsWebhookEvent;
