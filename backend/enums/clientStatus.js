// Client status enum for application-wide use
// Use CommonJS exports to match project style

module.exports = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  BLACKLISTED: 'blacklisted',
  PENDING_KYC_REVERIFICATION: 'pending_kyc_reverification',
  KYC_FAILED: 'kyc_failed'
});
