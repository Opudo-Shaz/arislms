const crypto = require('crypto');

/**
 * Device identification for the client portal.
 *
 * The browser generates a random secret once and sends it as `X-Device-Id`.
 * The server only ever handles/stores its SHA-256, so a DB or log leak can't
 * be replayed as a device identity.
 */

const DEVICE_ID_HEADER = 'x-device-id';
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

const hashDeviceId = (deviceId) => crypto.createHash('sha256').update(String(deviceId)).digest('hex');

/** Returns the device-id hash for a request, or null when the header is missing/malformed. */
function deviceHashFromRequest(req) {
  const raw = req.headers?.[DEVICE_ID_HEADER];
  if (typeof raw !== 'string' || !DEVICE_ID_PATTERN.test(raw)) return null;
  return hashDeviceId(raw);
}

/** Constant-time string comparison that tolerates different lengths. */
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

const normalizeIdNumber = (value) => String(value ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

/** Last four characters of a stored ID number, or null when it is too short to use. */
function lastFourOfId(idDocumentNumber) {
  const normalized = normalizeIdNumber(idDocumentNumber);
  return normalized.length >= 4 ? normalized.slice(-4) : null;
}

/** True when `entered` equals the last four characters of the stored ID number. */
function idLast4Matches(idDocumentNumber, entered) {
  const expected = lastFourOfId(idDocumentNumber);
  if (!expected) return false;
  return safeEqual(expected, normalizeIdNumber(entered));
}

module.exports = {
  DEVICE_ID_HEADER,
  DEVICE_ID_PATTERN,
  hashDeviceId,
  deviceHashFromRequest,
  lastFourOfId,
  idLast4Matches,
};
