/**
 * Kenyan mobile number helpers for the client sign-in page.
 *
 * Accepts 0712…, 712… or +254712… and reduces it to the 9 local digits.
 *
 * @module utils/kenyanPhone
 */

export const KE_DIAL_CODE = '+254'
const LOCAL_LENGTH = 9

/** Reduce any accepted input to at most 9 local digits (no leading 0 / 254). */
export const toLocalDigits = (raw) => {
  let digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.startsWith('254')) digits = digits.slice(3)
  digits = digits.replace(/^0+/, '')
  return digits.slice(0, LOCAL_LENGTH)
}

/** Valid = 9 digits starting with 7 or 1. */
export const isValidLocal = (local) => /^[17]\d{8}$/.test(local)

/** "712345678" → "712 345 678" (works for partial input too). */
export const formatLocal = (local) => local.replace(/(\d{3})(?=\d)/g, '$1 ')

/** "712345678" → "+254712345678". */
export const toE164 = (local) => `${KE_DIAL_CODE}${local}`

/** "712345678" → "+254 712 345 678". */
export const formatInternational = (local) => `${KE_DIAL_CODE} ${formatLocal(local)}`
