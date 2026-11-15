const CoSignerConsentStatus = require('../enums/coSignerConsentStatus');

/**
 * Block approving/disbursing a co-signed loan until the co-signer has accepted.
 * Pending, declined, expired and superseded consents all block. A NULL status means
 * the loan predates consent tracking (staff collected consent offline), so it passes.
 *
 * @param {{ coSignerId?: number|null, coSignerConsentStatus?: string|null }} loan
 * @param {'approved'|'disbursed'} action
 * @param {number} statusCode
 */
function assertCoSignerConsented(loan, action, statusCode) {
  if (!loan?.coSignerId) return;
  const status = loan.coSignerConsentStatus;
  if (status === null || status === undefined || status === CoSignerConsentStatus.ACCEPTED) return;

  const reason = status === CoSignerConsentStatus.DECLINED
    ? 'The co-signer has declined to co-sign this loan.'
    : `The co-signer has not consented yet (consent status: ${status}).`;
  throw Object.assign(new Error(`Loan cannot be ${action}. ${reason}`), { statusCode });
}

module.exports = { assertCoSignerConsented };
