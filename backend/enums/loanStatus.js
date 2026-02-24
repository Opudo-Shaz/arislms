// Loan status enum for application-wide use
// Use CommonJS exports to match project style

module.exports = Object.freeze({
  PENDING: 'pending',
  IN_REVIEW: 'in_review',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  DISBURSED: 'disbursed',
  ACTIVE: 'active',
  PARTIALLY_PAID: 'partially_paid',
  OVERDUE: 'overdue',
  DEFAULTED: 'defaulted',
  CLOSED: 'closed',
  CANCELLED: 'cancelled'
});
