const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');
const InvitationStatus = require('../enums/invitationStatus');

// A tokenized, time-limited invite that lets an admin pre-fill part of a new
// user's record (email, name, role, optional phone) and email/SMS them a
// registration link. No `User` row exists until the invite is accepted —
// mirrors the passwordResetToken hashed-token pattern (see
// models/passwordResetTokenModel.js).
const UserInvitation = sequelize.define(
  'UserInvitation',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    firstName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'first_name',
    },

    middleName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'middle_name',
    },

    lastName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'last_name',
    },

    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'role_id',
    },

    // SHA-256 hash of the raw token sent in the email/SMS — never store raw tokens
    tokenHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      field: 'token_hash',
    },

    status: {
      type: DataTypes.ENUM(Object.values(InvitationStatus)),
      allowNull: false,
      defaultValue: InvitationStatus.PENDING,
    },

    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
    },

    acceptedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'accepted_at',
    },

    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'revoked_at',
    },

    invitedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'invited_by',
    },

    createdUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'created_user_id',
    },
  },
  {
    tableName: 'user_invitations',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    freezeTableName: true,
  }
);

module.exports = UserInvitation;
