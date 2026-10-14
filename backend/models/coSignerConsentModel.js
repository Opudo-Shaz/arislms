const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');
const CoSignerConsentStatus = require('../enums/coSignerConsentStatus');

// A request for a co-signer to consent to guarantee a loan. The co-signer
// opens a tokenised link (sent by SMS/email), proves it's them with a one-time
// code, then accepts or declines. Only the SHA-256 hash of the link token is
// stored (same pattern as password-reset tokens and invitations).
const CoSignerConsent = sequelize.define('CoSignerConsent', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  loanId: { type: DataTypes.INTEGER, allowNull: false, field: 'loan_id' },
  coSignerId: { type: DataTypes.INTEGER, allowNull: false, field: 'co_signer_id' },
  borrowerId: { type: DataTypes.INTEGER, allowNull: false, field: 'borrower_id' },
  tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true, field: 'token_hash' },
  status: {
    type: DataTypes.ENUM(Object.values(CoSignerConsentStatus)),
    allowNull: false,
    defaultValue: CoSignerConsentStatus.PENDING,
  },
  expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
  respondedAt: { type: DataTypes.DATE, field: 'responded_at' },
  declineReason: { type: DataTypes.TEXT, field: 'decline_reason' },
  // Who triggered the request: 'portal' (borrower) or a staff user id as 'user:<id>'.
  requestedBy: { type: DataTypes.STRING(32), field: 'requested_by' },
}, {
  tableName: 'co_signer_consents',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['loan_id'] }, { fields: ['co_signer_id'] }],
});

module.exports = CoSignerConsent;
