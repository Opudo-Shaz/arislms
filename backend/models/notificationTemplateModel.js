// models/notificationTemplateModel.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');

// One row per eventKey. Holds a shared body per channel so a single message
// context ({{var}} placeholders) can be rendered per-channel by templateRenderer.
const NotificationTemplate = sequelize.define('NotificationTemplate', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  eventKey: { type: DataTypes.STRING(64), allowNull: false, unique: true, field: 'event_key' },
  description: { type: DataTypes.TEXT, allowNull: true },

  emailSubject: { type: DataTypes.STRING(255), allowNull: true, field: 'email_subject' },
  emailBody: { type: DataTypes.TEXT, allowNull: true, field: 'email_body' },

  smsBody: { type: DataTypes.TEXT, allowNull: true, field: 'sms_body' },

  pushTitle: { type: DataTypes.STRING(150), allowNull: true, field: 'push_title' },
  pushBody: { type: DataTypes.TEXT, allowNull: true, field: 'push_body' },

  inAppTitle: { type: DataTypes.STRING(150), allowNull: true, field: 'in_app_title' },
  inAppBody: { type: DataTypes.TEXT, allowNull: true, field: 'in_app_body' },

  emailEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'email_enabled' },
  smsEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'sms_enabled' },
  pushEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'push_enabled' },
  inAppEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'in_app_enabled' },

  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },

  createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
  modifiedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'modified_by' },
}, {
  tableName: 'notification_templates',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = NotificationTemplate;
