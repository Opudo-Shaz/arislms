const Joi = require('joi');

/**
 * Validation for POST /api/auth/verify-otp — completing an OTP-gated login.
 */
const verifyOtpSchema = Joi.object({
  otpToken: Joi.string().required(),
  code: Joi.string().trim().pattern(/^\d{4,10}$/).required().messages({
    'string.pattern.base': 'Code must be a 4–10 digit number',
  }),
});

module.exports = { verifyOtpSchema };
