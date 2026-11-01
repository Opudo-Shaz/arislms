// How a loan's upfront fees are handled.
// DEDUCTED: fees are netted off the disbursement (client receives principal − fees).
// ADDED_TO_PRINCIPAL: fees are financed (principal = requested + fees; client receives the requested amount).
module.exports = Object.freeze({
  DEDUCTED: 'deducted',
  ADDED_TO_PRINCIPAL: 'added_to_principal',
});
