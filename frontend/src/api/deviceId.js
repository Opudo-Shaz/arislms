/**
 * Per-browser device secret for the client portal.
 *
 * A random 256-bit value generated once and kept in localStorage, sent as the
 * `X-Device-Id` header. The backend ties login codes and sessions to it, so a
 * code intercepted elsewhere can't be redeemed from another device. Clearing
 * site data simply makes this browser a "new device" (one extra ID check).
 *
 * @module api/deviceId
 */

const STORAGE_KEY = 'arislms.portal.deviceId'

const randomId = () => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  // base64url, no padding: 43 chars
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

let memoryId = null

/** @returns {string} the persistent device id (in-memory fallback if storage is blocked) */
export const getDeviceId = () => {
  try {
    let id = localStorage.getItem(STORAGE_KEY)
    if (!id || !/^[A-Za-z0-9_-]{32,128}$/.test(id)) {
      id = randomId()
      localStorage.setItem(STORAGE_KEY, id)
    }
    return id
  } catch {
    memoryId = memoryId || randomId()
    return memoryId
  }
}
