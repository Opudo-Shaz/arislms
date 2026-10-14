const Joi = require('joi');

/**
 * Request schemas for the client self-service portal (/api/portal). None of
 * them accept a clientId — the client is always the authenticated principal.
 */

const requestOtpSchema = Joi.object({
  phone: Joi.string().trim().pattern(/^\+?[\d\s-]{7,20}$/).required().messages({
    'string.pattern.base': 'Enter a valid phone number',
    'any.required': 'Phone number is required',
  }),
  channel: Joi.string().valid('sms', 'email').default('sms'),
});

const verifyOtpSchema = Joi.object({
  otpToken: Joi.string().required(),
  code: Joi.string().trim().pattern(/^\d{4,10}$/).required().messages({
    'string.pattern.base': 'Code must be a 4–10 digit number',
  }),
});

const updateProfileSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: false }).max(255).allow(null, ''),
  secondaryPhone: Joi.string().trim().pattern(/^\+?[\d\s-]{7,20}$/).allow(null, '').messages({
    'string.pattern.base': 'Enter a valid phone number',
  }),
  address: Joi.object().unknown(true).allow(null),
  preferredContactMethod: Joi.string().valid('sms', 'email', 'phone').allow(null, ''),
}).min(1);

const loanRequestSchema = Joi.object({
  loanProductId: Joi.number().integer().required().messages({ 'any.required': 'Select a loan product' }),
  principalAmount: Joi.number().positive().precision(2).required().messages({
    'number.positive': 'Amount must be greater than zero',
    'any.required': 'Amount is required',
  }),
  termMonths: Joi.number().integer().min(1).max(120),
  notes: Joi.string().trim().max(1000).allow(null, ''),
  // Signed pick token from POST /portal/co-signers/lookup (never a raw client id).
  coSignerToken: Joi.string().allow(null, ''),
});

const coSignerLookupSchema = Joi.object({
  phone: Joi.string().trim().pattern(/^\+?[\d\s-]{7,20}$/).required().messages({
    'string.pattern.base': 'Enter a valid phone number',
    'any.required': 'Phone number is required',
  }),
});

const renominateSchema = Joi.object({
  coSignerToken: Joi.string().required().messages({ 'any.required': 'Select a co-signer first' }),
});

const consentOtpSchema = Joi.object({
  channel: Joi.string().valid('sms', 'email').default('sms'),
});

const consentRespondSchema = Joi.object({
  decision: Joi.string().valid('accept', 'decline').required(),
  code: Joi.string().trim().pattern(/^\d{4,10}$/).required().messages({
    'string.pattern.base': 'Code must be a 4–10 digit number',
  }),
  reason: Joi.string().trim().max(500).allow(null, ''),
});

const paymentReportSchema = Joi.object({
  amount: Joi.number().positive().precision(2).required().messages({
    'number.positive': 'Amount must be greater than zero',
    'any.required': 'Amount is required',
  }),
  transactionDate: Joi.date().iso().max('now').required().messages({
    'date.max': 'Transaction date cannot be in the future',
    'any.required': 'Transaction date is required',
  }),
  paymentMethod: Joi.string().valid('MPESA', 'BANK_TRANSFER', 'CASH', 'OTHER').default('MPESA'),
  externalRef: Joi.string().trim().min(4).max(128).required().messages({
    'any.required': 'Transaction reference (e.g. M-Pesa code) is required',
  }),
  payerPhone: Joi.string().trim().pattern(/^\+?\d{7,32}$/).allow(null, '').messages({
    'string.pattern.base': 'Enter a valid phone number',
  }),
  notes: Joi.string().trim().max(1000).allow(null, ''),
});

/** Staff amendments to a pending report (any subset). */
const amendPaymentReportSchema = Joi.object({
  amount: Joi.number().positive().precision(2),
  transactionDate: Joi.date().iso(),
  paymentMethod: Joi.string().max(32),
  externalRef: Joi.string().trim().min(1).max(128),
  payerPhone: Joi.string().trim().pattern(/^\+?\d{7,32}$/).allow(null, ''),
  notes: Joi.string().trim().max(1000).allow(null, ''),
  loanId: Joi.number().integer(),
}).min(1);

const reviewNotesSchema = Joi.object({
  reviewNotes: Joi.string().trim().max(1000).allow(null, ''),
});

const rejectPaymentReportSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(1000).required().messages({
    'any.required': 'A reason is required to reject a reported payment',
  }),
});

module.exports = {
  coSignerLookupSchema,
  renominateSchema,
  consentOtpSchema,
  consentRespondSchema,
  requestOtpSchema,
  verifyOtpSchema,
  updateProfileSchema,
  loanRequestSchema,
  paymentReportSchema,
  amendPaymentReportSchema,
  reviewNotesSchema,
  rejectPaymentReportSchema,
};
