const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { Sequelize } = require('sequelize');
const Client = require('../models/clientModel');
const NotificationChannel = require('../enums/notificationChannel');
const otpService = require('./otpService');
const systemConfigService = require('./systemConfigService');
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
 */

const OTP_PURPOSE_PORTAL_LOGIN = 'portal_login';
const RESEND_COOLDOWN_SECONDS = 60;

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

const signChallenge = (clientId, ttlMinutes) =>
  jwt.sign({ id: clientId, typ: 'client_otp' }, jwtSecret(), { expiresIn: `${ttlMinutes}m` });

/**
 * Step 1: send a login code to the client's phone (SMS) or saved email.
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
 * @param {{phone: string, channel: 'sms'|'email'}} params
 * @returns {Promise<{otpToken: string, channel: string, ttlMinutes: number}>}
 */
async function requestOtp({ phone, channel }, userAgent = 'unknown') {
  const ttlMinutes = await systemConfigService.getConfigValue('auth.otp.ttl_minutes', 'number', 10);
  const client = await findClientByPhone(phone);

  if (!client) {
    logger.info(`[portalAuth] OTP requested for unknown phone — generic response returned`);
    return { otpToken: signChallenge(0, ttlMinutes), channel, ttlMinutes };
  }

  // Email delivery needs a valid address on file; otherwise fall back to SMS.
  // Done silently (same response shape) so the reply never reveals whether a
  // number is registered or has an email.
  const deliveryChannel = channel === NotificationChannel.EMAIL && !isValidEmail(client.email)
    ? NotificationChannel.SMS
    : channel;

  // Resend cooldown: skip sending, but still hand back a valid challenge so the
  // previously sent code keeps working. No distinguishable error.
  const since = await otpService.secondsSinceLastIssued({ clientId: client.id, purpose: OTP_PURPOSE_PORTAL_LOGIN });
  if (since !== null && since < RESEND_COOLDOWN_SECONDS) {
    logger.info(`[portalAuth] OTP resend for client ${client.id} within cooldown — not re-sent`);
  } else {
    await otpService.generateAndSend({
      client,
      purpose: OTP_PURPOSE_PORTAL_LOGIN,
      channels: [deliveryChannel],
      userAgent,
    });
  }

  return { otpToken: signChallenge(client.id, ttlMinutes), channel, ttlMinutes };
}

/**
 * Step 2: verify the code and issue a client session.
 * @returns {Promise<{token: string, expiresIn: number, client: object}>}
 */
async function verifyOtp({ otpToken, code }, userAgent = 'unknown') {
  let payload;
  try {
    payload = jwt.verify(otpToken, jwtSecret());
  } catch {
    throw httpError('Your verification session has expired. Please request a new code.', 401);
  }
  if (payload?.typ !== 'client_otp') throw httpError('Invalid verification session.', 401);

  // Unknown-phone challenges (id 0) fall through to the same error as a wrong code.
  if (!payload.id) throw httpError('Invalid or expired verification code', 400);

  const client = await Client.findByPk(payload.id);
  if (!client) throw httpError('Invalid or expired verification code', 400);

  await otpService.verify({ clientId: client.id, purpose: OTP_PURPOSE_PORTAL_LOGIN, code, userAgent });

  // The code proves they own the number, so it's now safe to say why they
  // can't sign in — instead of a misleading "wrong code".
  const denial = portalAccessDenialReason(client);
  if (denial) {
    logger.info(`[portalAuth] client ${client.id} verified but portal access denied (status=${client.status}, portalEnabled=${client.portalEnabled})`);
    throw Object.assign(httpError(denial, 403), { code: PORTAL_ACCESS_DENIED });
  }

  const expiresIn = 86400;
  const token = jwt.sign(
    { id: client.id, typ: 'client', tokenVersion: client.tokenVersion || 0 },
    jwtSecret(),
    { expiresIn }
  );

  await client.update({ lastLoginAt: new Date() });

  await AuditLogger.log({
    entityType: 'LOGIN',
    entityId: client.id,
    action: 'CREATE',
    data: { portal: true, clientId: client.id },
    actorId: client.id,
    options: { actorType: 'CLIENT', source: userAgent },
  });

  logger.info(`[portalAuth] client ${client.id} logged in to portal`);
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

module.exports = { requestOtp, verifyOtp, findClientByPhone, OTP_PURPOSE_PORTAL_LOGIN };
