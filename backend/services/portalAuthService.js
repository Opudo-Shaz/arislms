const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { Sequelize } = require('sequelize');
const Client = require('../models/clientModel');
const NotificationChannel = require('../enums/notificationChannel');
const otpService = require('./otpService');
const clientDeviceService = require('./clientDeviceService');
const { safeNotify } = require('./notification/notificationTriggers');
const { isChannelAvailable } = require('./notification/notificationDispatcher');
const NotificationEventType = require('../enums/notificationEventType');
const { lastFourOfId, idLast4Matches } = require('../utils/deviceId');
const AuditLogger = require('../utils/auditLogger');
const { phoneMatchCandidates } = require('../utils/helpers');
const { portalAccessDenialReason, PORTAL_ACCESS_DENIED } = require('../utils/portalAccess');
const logger = require('../config/logger');

/**
 * Passwordless phone + OTP login for the client self-service portal.
 *
 * Clients are a separate principal from staff users: their session token
 * carries `typ: 'client'` and is only accepted by
 * authMiddleware.authenticateClient (staff `authenticate` rejects it).
 *
 * Device binding: every login code is tied to the device (see utils/deviceId)
 * that requested it, so a code copied from the SMS gateway is useless on any
 * other device. Because an insider can also *request* a code from their own
 * device, a device the client hasn't used before must additionally pass a
 * step-up (last digits of the national ID on file) before it is trusted.
 * The session token is bound to the device too.
 */

const OTP_PURPOSE_PORTAL_LOGIN = 'portal_login';
const RESEND_COOLDOWN_SECONDS = 60;

const STEP_UP_TOKEN_TTL_MINUTES = 5;
const GENERIC_CODE_ERROR = 'Invalid or expired verification code';
const DEVICE_STEP_UP_REQUIRED = 'DEVICE_STEP_UP_REQUIRED';

const jwtSecret = () => process.env.JWT_SECRET || 'secretkey';
const isValidEmail = (email) => !Joi.string().email({ tlds: false }).validate(email).error;

const httpError = (message, status) => Object.assign(new Error(message), { status });

/**
 * Find the single portal-eligible client whose primary phone matches `phone`
 * in any common format. Returns null when there is no match — or more than one
 * (ambiguous; staff must fix the duplicate phone before that client can log in).
 */
async function findClientByPhone(phone) {
  const candidates = phoneMatchCandidates(phone);
  if (!candidates.length) return null;

  const matches = await Client.findAll({
    where: Sequelize.where(
      Sequelize.fn('regexp_replace', Sequelize.col('phone'), '[^0-9]', '', 'g'),
      { [Sequelize.Op.in]: candidates }
    ),
    limit: 2,
  });
  if (matches.length > 1) {
    logger.warn(`[portalAuth] phone matches multiple clients (${matches.map((c) => c.id).join(', ')}) — login refused`);
    return null;
  }
  return matches[0] || null;
}

const signChallenge = (clientId, ttlMinutes, deviceHash) =>
  jwt.sign({ id: clientId, typ: 'client_otp', dh: deviceHash }, jwtSecret(), { expiresIn: `${ttlMinutes}m` });

const signStepUpToken = (clientId, deviceHash) =>
  jwt.sign({ id: clientId, typ: 'client_device_stepup', dh: deviceHash }, jwtSecret(), {
    expiresIn: `${STEP_UP_TOKEN_TTL_MINUTES}m`,
  });

/** Verify a short-lived challenge JWT of the given type that was issued to this device. */
function readDeviceBoundToken(token, typ, deviceHash, expiredMessage) {
  let payload;
  try {
    payload = jwt.verify(token, jwtSecret());
  } catch {
    throw httpError(expiredMessage, 401);
  }
  if (payload?.typ !== typ) throw httpError('Invalid verification session.', 401);
  // A challenge replayed from another device gets the same answer as a wrong code.
  if (!deviceHash || payload.dh !== deviceHash) throw httpError(GENERIC_CODE_ERROR, 400);
  return payload;
}

/**
 * Step 1: send a login code to the client's phone (SMS or WhatsApp) or saved email.
 *
 * The response is identical whether or not the phone belongs to a client (or
 * whether that client may use the portal), so the endpoint can't be used to
 * discover which numbers are registered or what state an account is in.
 * Clients who can't use the portal still get a code: once they prove they
 * own the number, verifyOtp tells them why instead of signing them in.
 * Email falls back to SMS when no valid email is saved, and resends inside
 * the cooldown are silently skipped. For unknown numbers the challenge token
 * points at client id 0, which has no OTP rows and therefore always fails
 * verification.
 *
 * @param {{phone: string, channel: 'sms'|'email'|'whatsapp'}} params
 * @returns {Promise<{otpToken: string, channel: string, ttlMinutes: number, otpLength: number}>}
 */
async function requestOtp({ phone, channel }, userAgent = 'unknown', { deviceHash } = {}) {
  if (!deviceHash) throw httpError('Device identification is missing. Please refresh the page and try again.', 400);
  const { ttlMinutes, length: otpLength } = await otpService.getOtpConfig();
  const client = await findClientByPhone(phone);

  if (!client) {
    logger.info(`[portalAuth] OTP requested for unknown phone — generic response returned`);
    return { otpToken: signChallenge(0, ttlMinutes, deviceHash), channel, ttlMinutes, otpLength };
  }

  // Email needs a valid address on file and WhatsApp needs to be enabled (globally and
  // on the OTP template); otherwise fall back to SMS. Done silently (same response
  // shape) so the reply never reveals whether a number is registered or has an email.
  let deliveryChannel = channel;
  if (channel === NotificationChannel.EMAIL && !isValidEmail(client.email)) {
    deliveryChannel = NotificationChannel.SMS;
  } else if (
    channel === NotificationChannel.WHATSAPP
    && !(await isChannelAvailable(NotificationEventType.OTP_VERIFICATION, NotificationChannel.WHATSAPP))
  ) {
    logger.warn(`[portalAuth] WhatsApp login code requested for client ${client.id} but the channel is not enabled — falling back to SMS`);
    deliveryChannel = NotificationChannel.SMS;
  }

  // Resend cooldown: skip sending, but still hand back a valid challenge so the
  // previously sent code keeps working. No distinguishable error. The cooldown
  // only protects a code held by *this* device: a request from another device
  // always issues a fresh code (which voids the pending one), so one device can
  // never ride on a code sent for a different one.
  const latest = await otpService.latestIssued({ clientId: client.id, purpose: OTP_PURPOSE_PORTAL_LOGIN });
  if (latest && latest.deviceHash === deviceHash && latest.secondsAgo < RESEND_COOLDOWN_SECONDS) {
    logger.info(`[portalAuth] OTP resend for client ${client.id} within cooldown — not re-sent`);
  } else {
    await otpService.generateAndSend({
      client,
      purpose: OTP_PURPOSE_PORTAL_LOGIN,
      channels: [deliveryChannel],
      deviceHash,
      userAgent,
    });
  }

  return { otpToken: signChallenge(client.id, ttlMinutes, deviceHash), channel, ttlMinutes, otpLength };
}

/**
 * Step 2: verify the code. On a trusted device this issues the client session;
 * on any other device it returns a short-lived `stepUpToken` and the caller
 * must finish with verifyDevice().
 * @returns {Promise<{token, expiresIn, client}|{stepUpRequired: true, stepUpToken: string}>}
 */
async function verifyOtp({ otpToken, code }, userAgent = 'unknown', { deviceHash, ip } = {}) {
  const payload = readDeviceBoundToken(
    otpToken, 'client_otp', deviceHash,
    'Your verification session has expired. Please request a new code.'
  );

  // Unknown-phone challenges (id 0) fall through to the same error as a wrong code.
  if (!payload.id) throw httpError(GENERIC_CODE_ERROR, 400);

  const client = await Client.findByPk(payload.id);
  if (!client) throw httpError(GENERIC_CODE_ERROR, 400);

  await otpService.verify({ clientId: client.id, purpose: OTP_PURPOSE_PORTAL_LOGIN, code, deviceHash, userAgent });
  assertPortalAccess(client);

  if (await clientDeviceService.isTrusted(client.id, deviceHash)) {
    return completeLogin(client, { deviceHash, userAgent, ip, newDevice: false });
  }

  // Unknown device: fail closed when there is nothing on file to step up with.
  if (!lastFourOfId(client.idDocumentNumber)) {
    logger.warn(`[portalAuth] client ${client.id} has no usable ID number on file — new-device login refused`);
    throw Object.assign(
      httpError('We could not verify this new device. Please contact the office to update your ID details.', 403),
      { code: 'DEVICE_STEP_UP_UNAVAILABLE' }
    );
  }

  logger.info(`[portalAuth] client ${client.id} verified code from an unrecognised device — step-up required`);
  return { stepUpRequired: true, code: DEVICE_STEP_UP_REQUIRED, stepUpToken: signStepUpToken(client.id, deviceHash) };
}

/**
 * Step 3 (new devices only): prove it is the account holder by entering the
 * last digits of the national ID on file, then trust the device and sign in.
 * Attempts are counted per client (not per device) and lock out after
 * auth.device.step_up_max_attempts, so rotating device ids doesn't help.
 */
async function verifyDevice({ stepUpToken, idLast4 }, userAgent = 'unknown', { deviceHash, ip } = {}) {
  const payload = readDeviceBoundToken(
    stepUpToken, 'client_device_stepup', deviceHash,
    'Your verification session has expired. Please sign in again.'
  );

  const client = payload.id ? await Client.findByPk(payload.id) : null;
  if (!client) throw httpError(GENERIC_CODE_ERROR, 400);
  assertPortalAccess(client);
  clientDeviceService.assertNotLocked(client);

  const { attempt, maxAttempts } = await clientDeviceService.reserveStepUpAttempt(client.id);
  if (attempt > maxAttempts) {
    throw Object.assign(
      httpError('Too many incorrect attempts. Please try again later or contact the office.', 429),
      { code: 'DEVICE_STEP_UP_LOCKED' }
    );
  }

  if (!idLast4Matches(client.idDocumentNumber, idLast4)) {
    await AuditLogger.log({
      entityType: 'LOGIN',
      entityId: client.id,
      action: 'UPDATE',
      data: { portal: true, event: 'device_step_up_failed', attempt, deviceHash: deviceHash.slice(0, 12), ip },
      actorId: client.id,
      options: { actorType: 'CLIENT', source: userAgent },
    });
    logger.warn(`[portalAuth] client ${client.id} failed new-device step-up (attempt ${attempt}/${maxAttempts})`);
    if (attempt >= maxAttempts) {
      throw Object.assign(
        httpError('Too many incorrect attempts. Please try again later or contact the office.', 429),
        { code: 'DEVICE_STEP_UP_LOCKED' }
      );
    }
    throw Object.assign(
      httpError(`Those ID digits don't match our records. ${maxAttempts - attempt} attempt(s) remaining.`, 400),
      { code: 'DEVICE_STEP_UP_FAILED' }
    );
  }

  await clientDeviceService.clearStepUpFailures(client.id);
  await clientDeviceService.trustDevice({ clientId: client.id, deviceHash, userAgent, ip });
  return completeLogin(client, { deviceHash, userAgent, ip, newDevice: true });
}

/** The code proves they own the number, so it's now safe to say why they can't sign in. */
function assertPortalAccess(client) {
  const denial = portalAccessDenialReason(client);
  if (denial) {
    logger.info(`[portalAuth] client ${client.id} verified but portal access denied (status=${client.status}, portalEnabled=${client.portalEnabled})`);
    throw Object.assign(httpError(denial, 403), { code: PORTAL_ACCESS_DENIED });
  }
}

/** Issue the device-bound session token and record the login. */
async function completeLogin(client, { deviceHash, userAgent, ip, newDevice }) {
  const expiresIn = 86400;
  const token = jwt.sign(
    { id: client.id, typ: 'client', tokenVersion: client.tokenVersion || 0, dh: deviceHash },
    jwtSecret(),
    { expiresIn }
  );

  await client.update({ lastLoginAt: new Date() });
  if (!newDevice) await clientDeviceService.touchDevice({ clientId: client.id, deviceHash, userAgent, ip });

  await AuditLogger.log({
    entityType: 'LOGIN',
    entityId: client.id,
    action: 'CREATE',
    data: { portal: true, clientId: client.id, newDevice, deviceHash: deviceHash.slice(0, 12), ip },
    actorId: client.id,
    options: { actorType: 'CLIENT', source: userAgent },
  });

  if (newDevice) await notifyNewDevice(client, { userAgent, ip });

  logger.info(`[portalAuth] client ${client.id} logged in to portal${newDevice ? ' (new device trusted)' : ''}`);
  return {
    token,
    expiresIn,
    client: {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      accountNumber: client.accountNumber,
    },
  };
}

/**
 * Tell the client by email (never SMS: that is the channel a rogue gateway
 * employee can read) that a new device was trusted. Skipped without a valid email.
 */
async function notifyNewDevice(client, { userAgent, ip }) {
  if (!isValidEmail(client.email)) return;
  await safeNotify(NotificationEventType.NEW_DEVICE_LOGIN, {
    recipients: [{ email: client.email }],
    channels: [NotificationChannel.EMAIL],
    context: {
      name: [client.firstName, client.lastName].filter(Boolean).join(' ') || 'there',
      appName: process.env.APP_NAME || 'ARISLMS',
      device: String(userAgent || 'unknown').slice(0, 120),
      ip: ip || 'unknown',
      time: new Date().toISOString(),
    },
    dedupeKey: `new-device-${client.id}-${Date.now()}`,
  });
}

module.exports = { requestOtp, verifyOtp, verifyDevice, findClientByPhone, OTP_PURPOSE_PORTAL_LOGIN };
