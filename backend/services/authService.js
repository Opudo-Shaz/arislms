const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const Role = require('../models/roleModel');
const UserStatus = require('../enums/userStatus');
const logger = require('../config/logger');
const AuditLogger = require('../utils/auditLogger');
const otpService = require('./otpService');
const systemConfigService = require('./systemConfigService');

/** OTP purpose scope for the login flow. */
const OTP_PURPOSE_LOGIN = 'login';

const jwtSecret = () => process.env.JWT_SECRET || 'secretkey';

/**
 * Issue an authenticated session (JWT + user payload) for a validated user.
 * Shared by the direct-login path and the post-OTP verification path.
 *
 * @param {object} user - User instance
 * @param {string} userAgent
 * @returns {Promise<{token, expiresIn, user}>}
 */
const issueSession = async (user, userAgent = 'unknown') => {
  // Generate JWT token. tokenVersion is embedded so it can be compared
  // against the current DB value on every request (see authMiddleware) —
  // bumping user.token_version invalidates this token before it expires.
  const token = jwt.sign(
    { id: user.id, role: user.role_id, tokenVersion: user.token_version },
    jwtSecret(),
    { expiresIn: '1d' }
  );

  // Log successful login to audit table
  await AuditLogger.log({
    entityType: 'LOGIN',
    entityId: user.id,
    action: 'CREATE',
    data: { email: user.email, role: user.role_id },
    actorId: user.id,
    options: { actorType: 'USER', source: userAgent },
  });

  logger.info(`User ${user.id} (${user.email}) successfully logged in`);

  // Resolve the role's permission list for the client, straight from the
  // roles table — no hardcoded role id. Whichever role was seeded/assigned
  // the wildcard `'*'` permission acts as Super Admin, so the frontend
  // `hasPermission()` short-circuits to true for that role.
  const role = await Role.findByPk(user.role_id, { attributes: ['permissions'] });
  const permissions = role?.permissions || [];

  return {
    token,
    expiresIn: 86400,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role_id,
      permissions,
    },
  };
};

/**
 * Validate a user's credentials + status. Returns the User instance on success,
 * throwing an error with `.status` on any failure.
 */
const authenticateCredentials = async (email, password) => {
  const user = await User.findOne({ where: { email } });
  if (!user) {
    const error = new Error('Invalid credentials');
    error.status = 401;
    throw error;
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    const error = new Error('Invalid credentials');
    error.status = 401;
    throw error;
  }

  // Only active users may log in
  if (user.status !== UserStatus.ACTIVE) {
    logger.warn(`Login blocked for user ${user.id} (${email}): status=${user.status}`);
    const error = new Error(`Account is ${user.status}. Please contact an administrator.`);
    error.status = 403;
    throw error;
  }

  return user;
};

const login = async (email, password, userAgent = 'unknown') => {
  try {
    const user = await authenticateCredentials(email, password);

    // Optional second factor: when enabled, don't issue the session yet —
    // send an OTP and hand back a short-lived challenge token instead.
    const otpRequired = await systemConfigService.getConfigValue(
      'auth.otp.require_on_login', 'boolean', false
    );

    if (otpRequired) {
      await otpService.generateAndSend({ user, purpose: OTP_PURPOSE_LOGIN, userAgent });

      const ttlMinutes = await systemConfigService.getConfigValue('auth.otp.ttl_minutes', 'number', 10);
      const otpToken = jwt.sign(
        { id: user.id, purpose: 'otp' },
        jwtSecret(),
        { expiresIn: `${ttlMinutes}m` }
      );

      logger.info(`Login for user ${user.id} (${email}) requires OTP — challenge issued`);
      return { otpRequired: true, otpToken };
    }

    return issueSession(user, userAgent);
  } catch (error) {
    logger.error(`Login error for email ${email}: ${error.message}`);
    throw error;
  }
};

/**
 * Complete a login that required OTP: verify the short-lived challenge token and
 * the submitted code, then issue the real session.
 *
 * @param {string} otpToken - signed challenge token returned by login()
 * @param {string} code     - the OTP code entered by the user
 * @param {string} [userAgent]
 * @returns {Promise<{token, expiresIn, user}>}
 */
const verifyLoginOtp = async (otpToken, code, userAgent = 'unknown') => {
  let payload;
  try {
    payload = jwt.verify(otpToken, jwtSecret());
  } catch (err) {
    const error = new Error('Your verification session has expired. Please log in again.');
    error.status = 401;
    throw error;
  }

  if (!payload || payload.purpose !== 'otp' || !payload.id) {
    const error = new Error('Invalid verification session.');
    error.status = 401;
    throw error;
  }

  const user = await User.findByPk(payload.id);
  if (!user) {
    const error = new Error('Invalid verification session.');
    error.status = 401;
    throw error;
  }

  // Re-check status in case it changed between the password and OTP steps.
  if (user.status !== UserStatus.ACTIVE) {
    const error = new Error(`Account is ${user.status}. Please contact an administrator.`);
    error.status = 403;
    throw error;
  }

  await otpService.verify({ userId: user.id, purpose: OTP_PURPOSE_LOGIN, code, userAgent });

  return issueSession(user, userAgent);
};

module.exports = { login, verifyLoginOtp };
