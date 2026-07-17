/**
 * Central password-strength policy.
 *
 * All three values can be overridden via environment variables so the
 * policy is configurable without code changes:
 *
 *   PASSWORD_STRENGTH_PATTERN  – RegExp source string (no delimiters / flags)
 *   PASSWORD_STRENGTH_MESSAGE  – Human-readable failure message
 *   PASSWORD_MIN_LENGTH        – Minimum character count (integer, default 8)
 *
 * The default pattern requires at least one letter, one digit, and one
 * character that is neither a letter nor a digit (special character).
 */

const pattern = process.env.PASSWORD_STRENGTH_PATTERN
  ? new RegExp(process.env.PASSWORD_STRENGTH_PATTERN)
  : /^(?=.*[a-zA-Z])(?=.*[0-9])(?=.*[^a-zA-Z0-9]).+$/;

const message =
  process.env.PASSWORD_STRENGTH_MESSAGE ||
  'Password must contain at least one letter, one number, and one special character';

const minLength = Number(process.env.PASSWORD_MIN_LENGTH) || 8;

module.exports = { pattern, message, minLength };
