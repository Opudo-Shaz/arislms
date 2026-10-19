// Provider-side lifecycle of an SMS, as reported by the gateway (sync response + delivery webhooks).
module.exports = Object.freeze({
  SUBMITTED: 'submitted', // accepted by the gateway, not yet confirmed sent (e.g. bulk batch queued)
  SENT: 'sent',           // handed to the carrier
  DELIVERED: 'delivered', // delivery receipt received
  FAILED: 'failed',       // gateway/carrier reported failure
});
