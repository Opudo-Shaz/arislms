// Lifecycle of a co-signer's consent to guarantee a loan.
// SUPERSEDED: replaced by a newer request (re-sent, or the borrower nominated someone else).
module.exports = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
  SUPERSEDED: 'superseded',
});
