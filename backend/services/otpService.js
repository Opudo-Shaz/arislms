const crypto = require('crypto');
const { Op } = require('sequelize');
const Otp = require('../models/otpModel');
const NotificationEventType = require('../enums/notificationEventType');
const { safeNotify } = require('./notification/notificationTriggers');
const systemConfigService = require('./systemConfigService');
const logger = require('../config/logger');
const AuditLogger = require('../utils/auditLogger');

/**
 * Reusable one-time-password service. Purpose-agnostic: the same generate/verify
 * pair backs any OTP flow (login, sensitive actions, ...) — callers pass a
 * `purpose` string that scopes each code to its use case.
 *
 * Codes are delivered through the existing notification outbox
 * (OTP_VERIFICATION template) so they inherit channel resolution, retries, and
 * admin visibility. OTP rows are queued with a high `priority` so they jump
 * ahead of the ordinary notification backlog.
 */

/**
 * Dev/test aid while no SMS gateway is configured: when OTP_DEBUG_LOG=true,
 * the raw code is written to the debug log. Never honoured when
 * NODE_ENV=production — codes would otherwise end up in logs/app.log.
 */
const shouldLogRawOtp = () =>
  process.env.OTP_DEBUG_LOG === 'true' && process.env.NODE_ENV !== 'production';

if (process.env.OTP_DEBUG_LOG === 'true' && process.env.NODE_ENV === 'production') {
  logger.warn('[otpService] OTP_DEBUG_LOG is ignored because NODE_ENV=production');
}

/** Outbox priority for OTP messages — well above the default (0) used elsewhere. */
const OTP_OUTBOX_PRIORITY = 100;

/** Hash a raw code with SHA-256 so the DB never holds the plaintext value. */
const hashCode = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex');

/**
 * Generate a numeric OTP of the given length using a cryptographically secure RNG.
 * Leading zeros are preserved (the value is a zero-padded string).
 * @param {number} length
 * @returns {string}
 */
function generateNumericCode(length) {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += crypto.randomInt(0, 10).toString();
  }
  return code;
}

/** Resolve the OTP config bundle from SystemConfig with sane defaults. */
async function getOtpConfig() {
  const [length, ttlMinutes, maxAttempts] = await Promise.all([
    systemConfigService.getConfigValue('auth.otp.length', 'number', 6),
    systemConfigService.getConfigValue('auth.otp.ttl_minutes', 'number', 10),
    systemConfigService.getConfigValue('auth.otp.max_attempts', 'number', 5),
  ]);
  return {
    length: Math.max(4, Math.min(10, length || 6)),
    ttlMinutes: ttlMinutes || 10,
    maxAttempts: maxAttempts || 5,
  };
}

/**
 * Resolve who an OTP belongs to. Staff users and portal clients live in
 * different tables, so each OTP row is keyed on exactly one of user_id /
 * client_id, and audit entries are attributed to the matching actor type.
 *
 * Audit entries are recorded against entity 'OTP' (the code row itself) —
 * the owner is the *actor*, not the entity. Logging them under USER/CLIENT
 * made "otp issued" read as "user/client record created/updated".
 */
function resolveSubject({ user, client, target }) {
  // Someone with no user/client row yet (e.g. registration): keyed on the
  // verified destination itself, attributed to the system actor.
  if (target && target.key) {
    return {
      ownerWhere: { target: target.key },
      label: `target=${target.key}`,
      name: target.name || target.email || target.phone || 'there',
      recipient: {
        ...(target.email ? { email: target.email } : {}),
        ...(target.phone ? { phone: target.phone } : {}),
      },
      audit: { actorId: AuditLogger.SYSTEM_USER_ID, actorType: 'SYSTEM' },
    };
  }
  if (client && client.id) {
    return {
      ownerWhere: { clientId: client.id },
      label: `client id=${client.id}`,
      name: [client.firstName, client.lastName].filter(Boolean).join(' ') || client.email,
      // No userId: clients have no in-app inbox (notifications.user_id references users).
      recipient: {
        ...(client.email ? { email: client.email } : {}),
        ...(client.phone ? { phone: client.phone } : {}),
      },
      audit: { actorId: client.id, actorType: 'CLIENT' },
    };
  }
  if (user && user.id) {
    return {
      ownerWhere: { userId: user.id },
      label: `user id=${user.id}`,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email,
      recipient: {
        ...(user.email ? { email: user.email } : {}),
        ...(user.phone ? { phone: user.phone } : {}),
        userId: user.id,
      },
      audit: { actorId: user.id, actorType: 'USER' },
    };
  }
  throw new Error('OTP requires a user or a client');
}

/**
 * Generate a fresh OTP for a user/client + purpose and dispatch it via the
 * notification outbox. Any still-valid unused codes for the same
 * (owner, purpose) are invalidated first so only the newest code works.
 *
 * @param {object} params
 * @param {object} [params.user]     - User instance/plain object (id, email, phone, first_name, last_name)
 * @param {object} [params.client]   - Client instance/plain object (id, email, phone, firstName, lastName); used instead of `user`
 * @param {{key: string, phone?: string, email?: string, name?: string}} [params.target] - For people with no user/client row yet; `key` scopes the code
 * @param {string} params.purpose    - e.g. 'login'
 * @param {string[]} [params.channels] - Restrict delivery to a subset of channels (default: template-enabled)
 * @param {object} [params.auditContext] - Extra fields stored with the audit entry so the OTP
 *   can be traced to what it authorised (e.g. `{ loanId, consentId }`)
 * @param {string} [params.userAgent]
 * @returns {Promise<{expiresAt: Date, ttlMinutes: number}>}
 */
async function generateAndSend({ user, client, target, purpose, channels = null, auditContext = null, userAgent = 'unknown' }) {
  if (!purpose) throw new Error('generateAndSend requires a purpose');
  const subject = resolveSubject({ user, client, target });

  const { length, ttlMinutes, maxAttempts } = await getOtpConfig();

  // Invalidate any previous unused codes for this (owner, purpose).
  await Otp.update(
    { usedAt: new Date() },
    { where: { ...subject.ownerWhere, purpose, usedAt: null } }
  );

  const code = generateNumericCode(length);
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  const otp = await Otp.create({ ...subject.ownerWhere, purpose, codeHash, expiresAt, maxAttempts });

  if (shouldLogRawOtp()) {
    const to = [subject.recipient.phone, subject.recipient.email].filter(Boolean).join(' / ') || 'no address';
    logger.debug(
      `[otpService] DEBUG OTP for ${subject.label} purpose=${purpose} channels=${channels ? channels.join(',') : 'default'} to=${to}: ${code} (expires in ${ttlMinutes}m)`
    );
  }

  const appName = process.env.APP_NAME || 'ARISLMS';
  const ownerKey = Object.entries(subject.ownerWhere)[0].join('-');

  await safeNotify(NotificationEventType.OTP_VERIFICATION, {
    recipients: [subject.recipient],
    context: { name: subject.name, code, ttlMinutes, appName, purpose },
    ...(channels ? { channels } : {}),
    priority: OTP_OUTBOX_PRIORITY,
    // Fresh dedupeKey per send so a resend always queues a new outbox row.
    dedupeKey: `otp-${purpose}-${ownerKey}-${Date.now()}`,
  });

  await AuditLogger.log({
    entityType: 'OTP',
    entityId: otp.id,
    action: 'CREATE',
    data: { event: 'otp_issued', purpose, ...(channels ? { channels } : {}), ...(auditContext || {}) },
    actorId: subject.audit.actorId,
    options: { actorType: subject.audit.actorType, source: userAgent },
  });

  logger.info(`[otpService] OTP issued for ${subject.label} purpose=${purpose}`);
  return { expiresAt, ttlMinutes };
}

/**
 * Verify a code for a user/client + purpose. Consumes the code on success.
 * Enforces the per-code attempt cap. Pass exactly one of userId / clientId / target.
 *
 * @param {object} params
 * @param {number} [params.userId]
 * @param {number} [params.clientId]
 * @param {string} [params.target] - the `target.key` the code was issued for
 * @param {string} params.purpose
 * @param {string} params.code
 * @param {object} [params.auditContext] - Extra fields stored with the audit entry (see generateAndSend)
 * @param {string} [params.userAgent]
 * @returns {Promise<boolean>} true on success
 * @throws {Error} with .status 400 (invalid/expired) or 429 (too many attempts)
 */
async function verify({ userId, clientId, target, purpose, code, auditContext = null, userAgent = 'unknown' }) {
  const ownerWhere = clientId ? { clientId } : userId ? { userId } : target ? { target } : null;
  if (!ownerWhere || !purpose || !code) {
    const err = new Error('Invalid or expired verification code');
    err.status = 400;
    throw err;
  }

  // Newest unused, non-expired code for this (owner, purpose).
  const record = await Otp.findOne({
    where: {
      ...ownerWhere,
      purpose,
      usedAt: null,
      expiresAt: { [Op.gt]: new Date() },
    },
    order: [['created_at', 'DESC']],
  });

  if (!record) {
    const err = new Error('Invalid or expired verification code');
    err.status = 400;
    throw err;
  }

  // Attempt cap reached — lock this code out.
  if (record.attempts >= record.maxAttempts) {
    await record.update({ usedAt: new Date() });
    const err = new Error('Too many incorrect attempts. Please request a new code.');
    err.status = 429;
    throw err;
  }

  await record.update({ attempts: record.attempts + 1 });

  if (record.codeHash !== hashCode(code)) {
    const remaining = record.maxAttempts - record.attempts;
    const err = new Error(
      remaining > 0
        ? `Incorrect code. ${remaining} attempt(s) remaining.`
        : 'Too many incorrect attempts. Please request a new code.'
    );
    err.status = remaining > 0 ? 400 : 429;
    throw err;
  }

  await record.update({ usedAt: new Date() });

  const isClient = Boolean(clientId);
  const isTarget = !clientId && !userId;
  const ownerId = isTarget ? AuditLogger.SYSTEM_USER_ID : clientId || userId;
  await AuditLogger.log({
    entityType: 'OTP',
    entityId: record.id,
    action: 'UPDATE',
    data: { event: 'otp_verified', purpose, ...(auditContext || {}) },
    actorId: ownerId,
    options: { actorType: isTarget ? 'SYSTEM' : isClient ? 'CLIENT' : 'USER', source: userAgent },
  });

  logger.info(`[otpService] OTP verified for ${isTarget ? `target=${target}` : `${isClient ? 'client' : 'user'} id=${ownerId}`} purpose=${purpose}`);
  return true;
}

/**
 * Seconds since the newest OTP for (owner, purpose) was issued, or null if none.
 * Lets callers enforce a resend cooldown.
 * @param {{userId?: number, clientId?: number, purpose: string}} params
 */
async function secondsSinceLastIssued({ userId, clientId, target, purpose }) {
  const ownerWhere = clientId ? { clientId } : target ? { target } : { userId };
  const last = await Otp.findOne({
    where: { ...ownerWhere, purpose },
    order: [['created_at', 'DESC']],
    attributes: ['created_at'],
  });
  if (!last) return null;
  return (Date.now() - new Date(last.get('created_at')).getTime()) / 1000;
}

module.exports = { generateAndSend, verify, secondsSinceLastIssued, OTP_OUTBOX_PRIORITY };
