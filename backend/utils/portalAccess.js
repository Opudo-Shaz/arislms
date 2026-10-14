/**
 * Why a client may not use the self-service portal, phrased for the client.
 *
 * Only shown to someone who has already proven they own the account (a
 * verified login code, or a valid session) — never in response to just
 * typing a phone number, which would let anyone probe account states.
 */
const ClientStatus = require('../enums/clientStatus');

const SUPPORT = 'Please contact support or visit a branch';

const STATUS_REASONS = {
  [ClientStatus.PENDING]: `Your account is still being set up. ${SUPPORT} to complete your registration.`,
  [ClientStatus.PENDING_KYC_REVERIFICATION]: `We need some more information to verify your identity. ${SUPPORT}.`,
  [ClientStatus.KYC_FAILED]: `We couldn't verify your identity. ${SUPPORT} to resolve this.`,
  [ClientStatus.INACTIVE]: `Your account is inactive. ${SUPPORT} to reactivate it.`,
  [ClientStatus.SUSPENDED]: `Your account has been suspended. ${SUPPORT} for more information.`,
  // Deliberately non-specific.
  [ClientStatus.BLACKLISTED]: `Online access isn't available for your account. ${SUPPORT}.`,
};

/** Machine-readable code the frontend uses to end the session and show the reason. */
const PORTAL_ACCESS_DENIED = 'PORTAL_ACCESS_DENIED';

/**
 * @param {{status: string, isActive: boolean, portalEnabled: boolean}} client
 * @returns {string|null} reason the client can't use the portal, or null if they can
 */
function portalAccessDenialReason(client) {
  if (!client) return null;
  if (client.status !== ClientStatus.ACTIVE) {
    return STATUS_REASONS[client.status] || `Online access isn't available for your account. ${SUPPORT}.`;
  }
  if (!client.isActive) return STATUS_REASONS[ClientStatus.INACTIVE];
  if (!client.portalEnabled) {
    return `Online access has been turned off for your account. ${SUPPORT} to turn it back on.`;
  }
  return null;
}

module.exports = { portalAccessDenialReason, PORTAL_ACCESS_DENIED };
