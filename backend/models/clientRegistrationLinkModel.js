const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');
const LinkStatus = require('../enums/clientRegistrationLinkStatus');

// An invite-only, multi-use, time-limited link that lets prospective clients
// self-register. Many clients can register through one link; usage is counted
// from clients.registration_link_id, not stored here.
const ClientRegistrationLink = sequelize.define(
  'ClientRegistrationLink',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    label: { type: DataTypes.STRING(150), allowNull: true },

    // SHA-256 of the raw token; the public endpoints look links up by this.
    tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true, field: 'token_hash' },

    // AES-GCM copy of the raw token so staff can re-copy the link later.
    tokenEncrypted: { type: DataTypes.TEXT, allowNull: false, field: 'token_encrypted' },

    // Only ACTIVE / REVOKED are stored; EXPIRED is derived from expiresAt.
    status: {
      type: DataTypes.ENUM(LinkStatus.ACTIVE, LinkStatus.REVOKED),
      allowNull: false,
      defaultValue: LinkStatus.ACTIVE,
    },

    expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
    revokedAt: { type: DataTypes.DATE, allowNull: true, field: 'revoked_at' },
    revokedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'revoked_by' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
  },
  {
    tableName: 'client_registration_links',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    freezeTableName: true,
  }
);

module.exports = ClientRegistrationLink;
