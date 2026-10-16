// EXPIRED is never stored: it is derived from expiresAt when a link is read.
module.exports = Object.freeze({
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
});
