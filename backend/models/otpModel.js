const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');

// One-time password codes. Purpose-agnostic so the same table backs any OTP
// flow (login, sensitive actions, etc.) — the `purpose` column scopes each row.
// Only the SHA-256 hash of the code is stored, never the plaintext.
const Otp = sequelize.define(
  'Otp',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
    },

    // What this code authorises, e.g. 'login'. Scopes generation + verification.
    purpose: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },

    // SHA-256 hash of the numeric code — never store the raw code.
    codeHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: 'code_hash',
    },

    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
    },

    // Set when the code is successfully consumed — prevents reuse.
    usedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'used_at',
    },

    // Number of verification attempts made against this code.
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    // Max verification attempts before the code is locked out.
    maxAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
      field: 'max_attempts',
    },
  },
  {
    tableName: 'otps',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    freezeTableName: true,
    indexes: [
      { fields: ['user_id', 'purpose'] },
    ],
  }
);

module.exports = Otp;
