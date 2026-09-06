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
 * Generate a fresh OTP for a user + purpose and dispatch it via the notification
 * outbox. Any still-valid unused codes for the same (user, purpose) are
 * invalidated first so only the newest code works.
 *
 * @param {object} params
 * @param {object} params.user       - User instance/plain object (id, email, phone, first_name, last_name)
 * @param {string} params.purpose    - e.g. 'login'
 * @param {string[]} [params.channels] - Restrict delivery to a subset of channels (default: template-enabled)
 * @param {string} [params.userAgent]
 * @returns {Promise<{expiresAt: Date, ttlMinutes: number}>}
 */
async function generateAndSend({ user, purpose, channels = null, userAgent = 'unknown' }) {
  if (!user || !user.id) throw new Error('generateAndSend requires a user');
  if (!purpose) throw new Error('generateAndSend requires a purpose');

  const { length, ttlMinutes, maxAttempts } = await getOtpConfig();

  // Invalidate any previous unused codes for this (user, purpose).
  await Otp.update(
    { usedAt: new Date() },
    { where: { userId: user.id, purpose, usedAt: null } }
  );

  const code = generateNumericCode(length);
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await Otp.create({ userId: user.id, purpose, codeHash, expiresAt, maxAttempts });

  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;
  const appName = process.env.APP_NAME || 'ARISLMS';

  const recipient = {
    ...(user.email ? { email: user.email } : {}),
    ...(user.phone ? { phone: user.phone } : {}),
    userId: user.id,
  };

  await safeNotify(NotificationEventType.OTP_VERIFICATION, {
    recipients: [recipient],
    context: { name, code, ttlMinutes, appName, purpose },
    ...(channels ? { channels } : {}),
    priority: OTP_OUTBOX_PRIORITY,
    // Fresh dedupeKey per send so a resend always queues a new outbox row.
    dedupeKey: `otp-${purpose}-${user.id}-${Date.now()}`,
  });

  await AuditLogger.log({
    entityType: 'USER',
    entityId: user.id,
    action: 'CREATE',
    data: { event: 'otp_issued', purpose },
    actorId: user.id,
    options: { actorType: 'USER', source: userAgent },
  });

  logger.info(`[otpService] OTP issued for user id=${user.id} purpose=${purpose}`);
  return { expiresAt, ttlMinutes };
}

/**
 * Verify a code for a user + purpose. Consumes the code on success. Enforces the
 * per-code attempt cap.
 *
 * @param {object} params
 * @param {number} params.userId
 * @param {string} params.purpose
 * @param {string} params.code
 * @param {string} [params.userAgent]
 * @returns {Promise<boolean>} true on success
 * @throws {Error} with .status 400 (invalid/expired) or 429 (too many attempts)
 */
async function verify({ userId, purpose, code, userAgent = 'unknown' }) {
  if (!userId || !purpose || !code) {
    const err = new Error('Invalid or expired verification code');
    err.status = 400;
    throw err;
  }

  // Newest unused, non-expired code for this (user, purpose).
  const record = await Otp.findOne({
    where: {
      userId,
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

  await AuditLogger.log({
    entityType: 'USER',
    entityId: userId,
    action: 'UPDATE',
    data: { event: 'otp_verified', purpose },
    actorId: userId,
    options: { actorType: 'USER', source: userAgent },
  });

  logger.info(`[otpService] OTP verified for user id=${userId} purpose=${purpose}`);
  return true;
}

module.exports = { generateAndSend, verify, OTP_OUTBOX_PRIORITY };
