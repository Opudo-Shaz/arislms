const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');

const AuditLog = sequelize.define('AuditLog', {
  audit_id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  entity_type: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  entity_id: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  action: {
    type: DataTypes.STRING(32),
    allowNull: false,
    validate: {
      isIn: [[
        'CREATE', 'UPDATE', 'DELETE', 'DISBURSE', 'REVERSE',
        'UPDATE_PRINCIPAL', 'KYC_VERIFY', 'KYC_REQUEST_INFO', 'KYC_REJECT',
        'ACTIVATE', 'DEACTIVATE', 'SUSPEND', 'BLACKLIST'
      ]],
    },
  },
  command_as_json: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  actor_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'User ID of the actor. Use 1 for system-initiated operations.',
  },
  actor_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['USER', 'SERVICE', 'SYSTEM']],
    },
  },
  occurred_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  correlation_id: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  source: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'audit_logs',
  timestamps: false,
  freezeTableName: true,
});

module.exports = AuditLog;
