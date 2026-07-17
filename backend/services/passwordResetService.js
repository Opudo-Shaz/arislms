const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const PasswordResetToken = require('../models/passwordResetTokenModel');
const User = require('../models/userModel');
const emailService = require('./email/EmailService');
const { resetPasswordTemplate } = require('./email/templates/resetPassword');
const logger = require('../config/logger');
const AuditLogger = require('../utils/auditLogger');

/** Token TTL in minutes */
const TOKEN_EXPIRY_MINUTES = 30;

/**
 * Hash a raw token with SHA-256 so the DB never holds the plaintext value.
 * @param {string} raw
 * @returns {string} 64-char hex hash
 */
const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

/**
 * Initiate a password reset for the given email address.
 * Throws a 404 if the email is not registered, or propagates email-send
 * errors so callers can surface specific feedback.
 *
 * @param {string} email
 * @param {string} [userAgent]
 */
async function requestPasswordReset(email, userAgent = 'unknown') {
  const user = await User.findOne({ where: { email } });

  if (!user) {
    logger.info(`[passwordResetService] Reset requested for unknown email: ${email}`);
    const err = new Error('No account found for that email address');
    err.status = 404;
    throw err;
  }

  // Invalidate all existing unused tokens for this user
  await PasswordResetToken.update(
    { usedAt: new Date() },
    { where: { userId: user.id, usedAt: null } }
  );

  // Generate a cryptographically random token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

  await PasswordResetToken.create({ userId: user.id, tokenHash, expiresAt });

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;

  const { subject, html, text } = resetPasswordTemplate({
    name: fullName,
    resetUrl,
    expiresMinutes: TOKEN_EXPIRY_MINUTES,
  });

  await emailService.send({ to: user.email, subject, html, text });

  await AuditLogger.log({
    entityType: 'USER',
    entityId: user.id,
    action: 'RESET_PASSWORD',
    data: { email, event: 'reset_requested' },
    actorId: user.id,
    options: { actorType: 'USER', source: userAgent },
  });

  logger.info(`[passwordResetService] Reset email sent to user id=${user.id}`);
}

/**
 * Validate a reset token and set a new password.
 *
 * @param {string} rawToken   - The plaintext token from the email link
 * @param {string} newPassword
 * @param {string} [userAgent]
 * @throws {Error} with .status set to 400 on invalid/expired token
 */
async function confirmPasswordReset(rawToken, newPassword, userAgent = 'unknown') {
  const tokenHash = hashToken(rawToken);

  const tokenRecord = await PasswordResetToken.findOne({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { [Op.gt]: new Date() },
    },
  });

  if (!tokenRecord) {
    const err = new Error('Invalid or expired password reset token');
    err.status = 400;
    throw err;
  }

  const user = await User.findByPk(tokenRecord.userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  // Hash new password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  // Persist new password and mark token as used atomically-ish
  await user.update({ password: hashedPassword });
  await tokenRecord.update({ usedAt: new Date() });

  await AuditLogger.log({
    entityType: 'USER',
    entityId: user.id,
    action: 'RESET_PASSWORD',
    data: { email: user.email, event: 'reset_completed' },
    actorId: user.id,
    options: { actorType: 'USER', source: userAgent },
  });

  logger.info(`[passwordResetService] Password reset completed for user id=${user.id}`);
}

module.exports = { requestPasswordReset, confirmPasswordReset };
