const Joi = require('joi');
const { pattern, message, minLength } = require('../../utils/passwordPolicy');

/**
 * Request DTOs for the self-service password-reset flow.
 *
 * POST /api/auth/forgot-password  →  forgotPasswordSchema
 * POST /api/auth/reset-password   →  resetPasswordSchema
 */
class ResetPasswordRequestDto {
  // ── POST /api/auth/forgot-password ────────────────────────────────────────
  static forgotPasswordSchema = Joi.object({
    email: Joi.string().email().trim().lowercase().required()
      .messages({
        'string.email':  'Email must be a valid email address',
        'string.empty':  'Email is required',
        'any.required':  'Email is required',
      }),
  });

  // ── POST /api/auth/reset-password ─────────────────────────────────────────
  static resetPasswordSchema = Joi.object({
    token: Joi.string().required()
      .messages({
        'string.empty': 'Token is required',
        'any.required': 'Token is required',
      }),

    newPassword: Joi.string()
      .min(minLength)
      .pattern(pattern)
      .required()
      .messages({
        'string.min':          `Password must be at least ${minLength} characters`,
        'string.pattern.base': message,
        'any.required':        'New password is required',
      }),
  });
}

module.exports = ResetPasswordRequestDto;
