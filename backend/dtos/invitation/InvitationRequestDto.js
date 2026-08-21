const Joi = require('joi');
const { pattern: pwPattern, message: pwMessage, minLength: pwMinLength } = require('../../utils/passwordPolicy');

/**
 * Request DTOs for the invite-only registration flow.
 *
 * POST /api/invitations        →  createSchema  (admin invites someone)
 * POST /api/invitations/accept →  acceptSchema  (invitee completes registration)
 */
class InvitationRequestDto {
  // ── POST /api/invitations ──────────────────────────────────────────────
  // Requires email + role + at least one of first/last name. Phone optional.
  static createSchema = Joi.object({
    email: Joi.string().email().trim().lowercase().required()
      .messages({
        'string.email': 'Email must be a valid email address',
        'string.empty': 'Email is required',
        'any.required': 'Email is required'
      }),

    role: Joi.number().integer().required()
      .messages({
        'any.required': 'Role is required',
        'number.base': 'Role must be a number'
      }),

    first_name: Joi.string().trim().min(2).max(100)
      .messages({
        'string.min': 'First name must be at least 2 characters',
        'string.max': 'First name cannot exceed 100 characters'
      }),

    middle_name: Joi.string().trim().min(2).max(100).allow(null, '')
      .messages({
        'string.min': 'Middle name must be at least 2 characters',
        'string.max': 'Middle name cannot exceed 100 characters'
      }),

    last_name: Joi.string().trim().min(2).max(100)
      .messages({
        'string.min': 'Last name must be at least 2 characters',
        'string.max': 'Last name cannot exceed 100 characters'
      }),

    phone: Joi.string().pattern(/^\d{7,}$/).allow(null, '')
      .messages({
        'string.pattern.base': 'Phone must contain at least 7 digits'
      }),
  })
    .or('first_name', 'last_name')
    .messages({ 'object.missing': 'Provide at least a first or last name' });

  // ── POST /api/invitations/accept ───────────────────────────────────────
  // email/role/middle_name come from the invitation record itself; the
  // invitee supplies whatever wasn't pre-filled plus password. id_number
  // stays optional even here (mirrors normal user creation).
  static acceptSchema = Joi.object({
    token: Joi.string().required()
      .messages({
        'string.empty': 'Token is required',
        'any.required': 'Token is required'
      }),

    first_name: Joi.string().trim().min(2).max(100).required()
      .messages({
        'string.empty': 'First name is required',
        'string.min': 'First name must be at least 2 characters',
        'string.max': 'First name cannot exceed 100 characters',
        'any.required': 'First name is required'
      }),

    middle_name: Joi.string().trim().min(2).max(100).allow(null, '')
      .messages({
        'string.min': 'Middle name must be at least 2 characters',
        'string.max': 'Middle name cannot exceed 100 characters'
      }),

    last_name: Joi.string().trim().min(2).max(100).required()
      .messages({
        'string.empty': 'Last name is required',
        'string.min': 'Last name must be at least 2 characters',
        'string.max': 'Last name cannot exceed 100 characters',
        'any.required': 'Last name is required'
      }),

    phone: Joi.string().pattern(/^\d{7,}$/).allow(null, '')
      .messages({
        'string.pattern.base': 'Phone must contain at least 7 digits'
      }),

    id_number: Joi.string().trim().min(4).max(50).allow(null, '')
      .messages({
        'string.min': 'ID number must be at least 4 characters',
        'string.max': 'ID number cannot exceed 50 characters'
      }),

    password: Joi.string()
      .min(pwMinLength)
      .pattern(pwPattern)
      .required()
      .messages({
        'string.min': `Password must be at least ${pwMinLength} characters`,
        'string.pattern.base': pwMessage,
        'any.required': 'Password is required'
      }),
  });
}

module.exports = InvitationRequestDto;
