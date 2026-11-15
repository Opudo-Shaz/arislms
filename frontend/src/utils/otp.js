/**
 * Small helpers shared by every one-time-code screen (portal and staff sign-in,
 * client self-registration, co-signer consent).
 *
 * @module utils/otp
 */

/** Seconds as m:ss, for the "Resend in …" countdown. */
export const formatCountdown = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

// Matches the backend's resend cooldown (60s for portal, registration and co-signer codes): a resend
// requested sooner is rejected or skipped server-side, so a shorter countdown would be a lie.
export const OTP_RESEND_SECONDS = 60
// Backend defaults for `auth.otp.length` / `auth.otp.ttl_minutes`; replaced by the values in the send response.
export const DEFAULT_OTP_LENGTH = 6
export const DEFAULT_OTP_TTL_MINUTES = 10
