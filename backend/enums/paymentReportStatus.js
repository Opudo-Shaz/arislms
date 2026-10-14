// Lifecycle of a client-reported (manual) payment awaiting staff confirmation.
// PROCESSING is a short-lived claim held while the payment is being applied,
// so two reviewers can't apply the same report twice.
module.exports = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  APPLIED: 'applied',
  REJECTED: 'rejected',
});
