/**
 * Auth session storage helpers.
 *
 * Persists the JWT and user profile returned by `POST /api/auth/login`
 * to localStorage so the session survives page reloads.
 *
 * @module api/authStorage
 */

import config from '../config'

/**
 * Read the persisted auth session.
 * @param {string} [key] - storage key (defaults to the staff session key)
 * @returns {{ token: string, user: object, role: number|null } | null}
 */
export const getStoredAuth = (key = config.authStorageKey) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Persist the auth session.
 * @param {{ token: string, user: object, role: number|null }} auth
 * @param {string} [key] - storage key (defaults to the staff session key)
 */
export const setStoredAuth = (auth, key = config.authStorageKey) => {
  localStorage.setItem(key, JSON.stringify(auth))
}

/**
 * Remove the persisted auth session.
 * @param {string} [key] - storage key (defaults to the staff session key)
 */
export const clearStoredAuth = (key = config.authStorageKey) => {
  localStorage.removeItem(key)
}

/** @returns {string | null} The persisted bearer token, if any. */
export const getToken = () => getStoredAuth()?.token ?? null

/**
 * Decode the payload of a JWT without verifying its signature.
 * Used only to read non-sensitive claims (id, role) on the client.
 * @param {string} token
 * @returns {object | null}
 */
export const decodeToken = (token) => {
  try {
    const payload = token.split('.')[1]
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(normalized)
        .split('')
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(''),
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}
