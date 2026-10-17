// Mobile metadata: isValid() only accepts mobile numbers (SMS/OTP need one), so valid landlines are rejected.
const { parsePhoneNumberFromString } = require('libphonenumber-js/mobile');
const Joi = require('joi');

/**
 * Central phone-number validation/normalisation built on libphonenumber-js.
 *
 * Every phone submitted to the API is validated here so the rules live in one
 * place. We start with Kenya as the default region: bare national numbers like
 * '0712345678' or '712345678' are interpreted as Kenyan, while anything in
 * full international form ('+1...') is validated against its own country.
 *
 * The default region is overridable via DEFAULT_PHONE_COUNTRY (ISO 3166-1
 * alpha-2, e.g. 'KE', 'UG', 'TZ').
 */

const DEFAULT_COUNTRY = (process.env.DEFAULT_PHONE_COUNTRY || 'KE').toUpperCase();

/**
 * Parse a raw phone string into a libphonenumber-js PhoneNumber, or null.
 * @param {string} value
 * @param {string} [defaultCountry]
 */
function parsePhone(value, defaultCountry = DEFAULT_COUNTRY) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  try {
    return parsePhoneNumberFromString(raw, defaultCountry) || null;
  } catch {
    return null;
  }
}

/**
 * True when `value` is a valid phone number for the default (or given) region.
 * @param {string} value
 * @param {string} [defaultCountry]
 * @returns {boolean}
 */
function isValidPhone(value, defaultCountry = DEFAULT_COUNTRY) {
  const parsed = parsePhone(value, defaultCountry);
  return Boolean(parsed && parsed.isValid());
}

/**
 * Normalise a valid phone to E.164 (e.g. '0712345678' → '+254712345678'),
 * or null when the input is not a valid number.
 * @param {string} value
 * @param {string} [defaultCountry]
 * @returns {string|null}
 */
function normalizePhone(value, defaultCountry = DEFAULT_COUNTRY) {
  const parsed = parsePhone(value, defaultCountry);
  return parsed && parsed.isValid() ? parsed.number : null;
}

/**
 * Reusable Joi schema for a phone field. Validates with libphonenumber-js and
 * rewrites the value to E.164 so stored phones are consistent.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.required=false]     - require the field
 * @param {boolean} [opts.allowEmpty=true]    - accept null / '' (ignored when required)
 * @param {string}  [opts.defaultCountry]     - override the default region
 * @param {string}  [opts.label='Phone']      - human label used in messages
 * @returns {Joi.StringSchema}
 */
function phoneSchema({ required = false, allowEmpty = true, defaultCountry = DEFAULT_COUNTRY, label = 'Phone' } = {}) {
  let schema = Joi.string().trim().custom((value, helpers) => {
    const normalized = normalizePhone(value, defaultCountry);
    if (!normalized) return helpers.error('phone.invalid');
    return normalized;
  }, 'phone validation').messages({
    'phone.invalid': `${label} must be a valid phone number`,
    'any.required': `${label} is required`,
    'string.empty': `${label} is required`,
  });

  if (required) {
    schema = schema.required();
  } else if (allowEmpty) {
    schema = schema.allow(null, '');
  }

  return schema;
}

module.exports = {
  DEFAULT_COUNTRY,
  parsePhone,
  isValidPhone,
  normalizePhone,
  phoneSchema,
};
