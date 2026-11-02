const sequelize = require('../config/sequalize_db');
const ClientDevice = require('../models/clientDeviceModel');
const Client = require('../models/clientModel');
const cache = require('../utils/appCache');
const { getOrSet } = require('../utils/cacheAside');
const systemConfigService = require('./systemConfigService');
const AuditLogger = require('../utils/auditLogger');

/**
 * Trusted-device registry and national-ID step-up bookkeeping for the portal.
 * A device becomes trusted only after OTP + step-up succeed; later logins on
 * that device need just the OTP, and sessions are bound to it.
 */

const TRUST_CACHE_TTL_SECONDS = 60;
const trustKey = (clientId, deviceHash) => `auth:device:${clientId}:${deviceHash}`;

const httpError = (message, status, code) =>
  Object.assign(new Error(message), { status, ...(code ? { code } : {}) });

/** True when the device is trusted and not revoked for this client (cached briefly). */
async function isTrusted(clientId, deviceHash) {
  if (!clientId || !deviceHash) return false;
  return getOrSet(cache, trustKey(clientId, deviceHash), TRUST_CACHE_TTL_SECONDS, async () => {
    const row = await ClientDevice.findOne({
      where: { clientId, deviceHash, revokedAt: null },
      attributes: ['id'],
    });
    return Boolean(row);
  });
}

const clip = (value, max) => (value ? String(value).slice(0, max) : null);

/** Trust (or re-trust a revoked) device and record where it was seen. */
async function trustDevice({ clientId, deviceHash, userAgent, ip }) {
  const now = new Date();
  const values = { userAgent: clip(userAgent, 255), lastIp: clip(ip, 64), lastSeenAt: now };
  const [row, created] = await ClientDevice.findOrCreate({
    where: { clientId, deviceHash },
    defaults: { ...values, trustedAt: now },
  });
  if (!created) await row.update({ ...values, trustedAt: row.revokedAt ? now : row.trustedAt, revokedAt: null });
  cache.del(trustKey(clientId, deviceHash));
  return row;
}

async function touchDevice({ clientId, deviceHash, userAgent, ip }) {
  await ClientDevice.update(
    { lastSeenAt: new Date(), lastIp: clip(ip, 64), userAgent: clip(userAgent, 255) },
    { where: { clientId, deviceHash, revokedAt: null } }
  );
}

async function listDevices(clientId) {
  return ClientDevice.findAll({
    where: { clientId, revokedAt: null },
    order: [['last_seen_at', 'DESC']],
  });
}

/**
 * Revoke one of the client's devices by row id (its sessions end immediately).
 * Returns false when not found. `actor` is recorded in the audit log: the
 * client themself ({ actorType: 'CLIENT' }) or a staff user ({ actorType: 'USER' }).
 */
async function revokeDevice(clientId, deviceId, { actorId, actorType = 'CLIENT', userAgent = 'unknown' } = {}) {
  const row = await ClientDevice.findOne({ where: { id: deviceId, clientId, revokedAt: null } });
  if (!row) return false;
  await row.update({ revokedAt: new Date() });
  cache.del(trustKey(clientId, row.deviceHash));

  await AuditLogger.log({
    entityType: 'CLIENT',
    entityId: clientId,
    action: 'DELETE',
    data: { event: 'device_revoked', deviceId: row.id, device: row.userAgent, lastIp: row.lastIp },
    actorId: actorId || clientId,
    options: { actorType, source: userAgent },
  });
  return true;
}

async function getStepUpConfig() {
  const [maxAttempts, lockMinutes] = await Promise.all([
    systemConfigService.getConfigValue('auth.device.step_up_max_attempts', 'number', 5),
    systemConfigService.getConfigValue('auth.device.step_up_lock_minutes', 'number', 30),
  ]);
  return { maxAttempts: maxAttempts || 5, lockMinutes: lockMinutes || 30 };
}

/** Throws 429 while the client's step-up is locked out. */
function assertNotLocked(client) {
  if (client.stepUpLockedUntil && new Date(client.stepUpLockedUntil) > new Date()) {
    throw httpError(
      'Too many incorrect attempts. Please try again later or contact the office.',
      429,
      'DEVICE_STEP_UP_LOCKED'
    );
  }
}

/**
 * Atomically reserve one step-up attempt *before* the digits are compared, so
 * concurrent guesses can't all slip under the cap. The counter restarts after
 * a lock expires or 24h without failures. Returns { attempt, maxAttempts };
 * `attempt` above `maxAttempts` means the caller must refuse without comparing.
 * Reaching `maxAttempts` locks the client's step-up for the configured time.
 */
async function reserveStepUpAttempt(clientId) {
  const { maxAttempts, lockMinutes } = await getStepUpConfig();
  const [rows] = await sequelize.query(
    `UPDATE clients
        SET step_up_failed_attempts = CASE
              WHEN step_up_last_failed_at IS NULL
                OR step_up_last_failed_at < NOW() - INTERVAL '24 hours'
                OR (step_up_locked_until IS NOT NULL AND step_up_locked_until < NOW()) THEN 1
              ELSE step_up_failed_attempts + 1 END,
            step_up_locked_until = CASE
              WHEN step_up_locked_until IS NOT NULL AND step_up_locked_until < NOW() THEN NULL
              ELSE step_up_locked_until END,
            step_up_last_failed_at = NOW()
      WHERE id = :clientId
      RETURNING step_up_failed_attempts`,
    { replacements: { clientId } }
  );
  const attempt = Number(rows?.[0]?.step_up_failed_attempts || 1);
  if (attempt >= maxAttempts) {
    await Client.update(
      { stepUpLockedUntil: new Date(Date.now() + lockMinutes * 60 * 1000) },
      { where: { id: clientId } }
    );
  }
  return { attempt, maxAttempts };
}

async function clearStepUpFailures(clientId) {
  await Client.update(
    { stepUpFailedAttempts: 0, stepUpLastFailedAt: null, stepUpLockedUntil: null },
    { where: { id: clientId } }
  );
}

module.exports = {
  isTrusted,
  trustDevice,
  touchDevice,
  listDevices,
  revokeDevice,
  assertNotLocked,
  reserveStepUpAttempt,
  clearStepUpFailures,
};
