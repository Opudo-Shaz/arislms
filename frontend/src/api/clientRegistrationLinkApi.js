/**
 * Client registration links API.
 *
 * Staff endpoints (`/client-registration-links`) use the bearer token. The
 * public endpoints back the invite-only registration form and send no auth:
 * the link token in the path is the credential.
 *
 * @module api/clientRegistrationLinkApi
 */

import http from './http'

// ── Staff ──────────────────────────────────────────────────────────────────

/** @param {{ status?: string }} [params] @returns {Promise<object[]>} */
export const listLinks = async (params = {}) => {
  const res = await http.get('/client-registration-links', { params })
  return res?.data ?? []
}

/** Link plus the clients who registered through it. @param {number|string} id */
export const getLink = async (id) => {
  const res = await http.get(`/client-registration-links/${id}`)
  return res?.data ?? null
}

/**
 * @param {{ label?: string, recipients?: string[] }} payload emails and/or phone numbers
 * @returns {Promise<{ link: object, url: string, warnings: string[], sent: {email: number, sms: number} }>}
 */
export const createLink = async (payload) => {
  const res = await http.post('/client-registration-links', payload)
  return { link: res?.data, url: res?.url, warnings: res?.warnings || [], sent: res?.sent }
}

/** @param {number|string} id @returns {Promise<string>} shareable URL */
export const getLinkUrl = async (id) => {
  const res = await http.get(`/client-registration-links/${id}/url`)
  return res?.url
}

/** @param {number|string} id */
export const revokeLink = async (id) => {
  const res = await http.post(`/client-registration-links/${id}/revoke`)
  return res?.data
}

// ── Public (no auth) ───────────────────────────────────────────────────────

const base = (token) => `/public/client-registration/${encodeURIComponent(token)}`

/** @returns {Promise<{ label: string|null, expiresAt: string, otpRequired: boolean, kycDocumentsRequired: boolean }>} */
export const resolveLink = async (token) => {
  const res = await http.get(base(token), { auth: false })
  return res?.data
}

/** @param {{ phone: string, email?: string, name?: string, channel?: 'sms'|'email' }} payload */
export const requestPublicOtp = async (token, payload) => {
  const res = await http.post(`${base(token)}/otp/request`, payload, { auth: false })
  return res?.data
}

/** @returns {Promise<{ verificationToken: string, expiresInMinutes: number }>} */
export const verifyPublicOtp = async (token, payload) => {
  const res = await http.post(`${base(token)}/otp/verify`, payload, { auth: false })
  return res?.data
}

/**
 * @param {string} token
 * @param {object} payload form fields (sent as a JSON string alongside the files)
 * @param {Record<string, File>} files keyed by document type (client_photo, national_id, passport, ...)
 * @returns {Promise<{ referenceNumber: string }>}
 */
export const submitRegistration = async (token, payload, files) => {
  const body = new FormData()
  body.append('payload', JSON.stringify(payload))
  Object.entries(files).forEach(([field, file]) => {
    if (file) body.append(field, file)
  })
  const res = await http.post(`${base(token)}/submit`, body, { auth: false })
  return res?.data
}

export default {
  listLinks,
  getLink,
  createLink,
  getLinkUrl,
  revokeLink,
  resolveLink,
  requestPublicOtp,
  verifyPublicOtp,
  submitRegistration,
}
