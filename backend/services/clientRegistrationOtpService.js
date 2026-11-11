const jwt = require('jsonwebtoken');
const otpService = require('./otpService');
const systemConfigService = require('./systemConfigService');
const NotificationChannel = require('../enums/notificationChannel');
const { normalizePhone } = require('../utils/phone');
const { isChannelAvailable } = require('./notification/notificationDispatcher');
const NotificationEventType = require('../enums/notificationEventType');

/**
 * Phone ownership check for new clients, used by both self-registration links
 * and staff-created clients. When `client.registration.enable_otp` is on, the
 * applicant gets a code, proves it, and receives a short-lived token bound to
 * that phone number which the create/submit call must then present.
 */

const PURPOSE = 'client_registration';
const TOKEN_TYPE = 'client_reg_phone';
const TOKEN_TTL_MINUTES = 30;
const RESEND_COOLDOWN_SECONDS = 60;

const jwtSecret = () => process.env.JWT_SECRET || 'secretkey';
const httpError = (message, status) => Object.assign(new Error(message), { status });

const isEnabled = () => systemConfigService.getConfigValue('client.registration.enable_otp', 'boolean', false);

function requirePhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) throw httpError('A valid phone number is required', 400);
  return normalized;
}

const isWhatsAppAvailable = () =>
  isChannelAvailable(NotificationEventType.OTP_VERIFICATION, NotificationChannel.WHATSAPP);

/**
 * Send a code to the phone itself (SMS, or WhatsApp when requested and enabled), so a verified
 * code proves the phone number; never creates a client. Falls back to SMS when WhatsApp is unavailable.
 */
async function requestCode({ phone, name, channel = NotificationChannel.SMS }, userAgent = 'unknown') {
  const key = requirePhone(phone);

  const since = await otpService.secondsSinceLastIssued({ target: key, purpose: PURPOSE });
  if (since !== null && since < RESEND_COOLDOWN_SECONDS) {
    throw httpError(`Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - since)}s before requesting another code`, 429);
  }

  const deliveryChannel = channel === NotificationChannel.WHATSAPP && (await isWhatsAppAvailable())
    ? NotificationChannel.WHATSAPP
    : NotificationChannel.SMS;

  const { ttlMinutes } = await otpService.generateAndSend({
    target: { key, phone: key, name },
    purpose: PURPOSE,
    channels: [deliveryChannel],
    userAgent,
  });
  return { channel: deliveryChannel, ttlMinutes };
}

/** Consume the code and return a token proving this phone number was verified. */
async function verifyCode({ phone, code }, userAgent = 'unknown') {
  const key = requirePhone(phone);
  await otpService.verify({ target: key, purpose: PURPOSE, code, userAgent });
  const verificationToken = jwt.sign({ typ: TOKEN_TYPE, phone: key }, jwtSecret(), {
    expiresIn: `${TOKEN_TTL_MINUTES}m`,
  });
  return { verificationToken, expiresInMinutes: TOKEN_TTL_MINUTES };
}

/** No-op when the config is off; otherwise the token must be valid and match `phone`. */
async function assertVerified(phone, verificationToken) {
  if (!(await isEnabled())) return;

  const key = requirePhone(phone);
  let payload;
  try {
    payload = jwt.verify(String(verificationToken || ''), jwtSecret());
  } catch {
    throw httpError('Phone verification is required. Verify the phone number and try again.', 400);
  }
  if (payload?.typ !== TOKEN_TYPE || payload.phone !== key) {
    throw httpError('The verified phone number does not match the one submitted.', 400);
  }
}

module.exports = { isEnabled, isWhatsAppAvailable, requestCode, verifyCode, assertVerified };
