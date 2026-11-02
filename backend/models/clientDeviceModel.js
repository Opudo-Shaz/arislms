const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');

// Devices a portal client has proven themselves on (OTP + national-ID step-up).
// Only the SHA-256 of the device secret is stored, never the secret itself.
// A device row exists only once trusted; revoking sets revokedAt.
const ClientDevice = sequelize.define(
  'ClientDevice',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    clientId: { type: DataTypes.INTEGER, allowNull: false, field: 'client_id' },
    deviceHash: { type: DataTypes.STRING(64), allowNull: false, field: 'device_hash' },
    userAgent: { type: DataTypes.STRING(255), allowNull: true, field: 'user_agent' },
    lastIp: { type: DataTypes.STRING(64), allowNull: true, field: 'last_ip' },
    trustedAt: { type: DataTypes.DATE, allowNull: false, field: 'trusted_at' },
    lastSeenAt: { type: DataTypes.DATE, allowNull: true, field: 'last_seen_at' },
    revokedAt: { type: DataTypes.DATE, allowNull: true, field: 'revoked_at' },
  },
  {
    tableName: 'client_devices',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    freezeTableName: true,
    indexes: [{ unique: true, fields: ['client_id', 'device_hash'] }],
  }
);

module.exports = ClientDevice;
