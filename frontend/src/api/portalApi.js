/**
 * Client self-service portal API (`/api/portal`).
 *
 * Every authenticated call is scoped server-side to the logged-in client —
 * none of these take a client id.
 *
 * @module api/portalApi
 */

import portalHttp, { portalAxios } from './portalHttp'
import { EMPTY_PAGINATION } from './pagination'

const clean = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined))

const page = (res) => ({ data: res?.data ?? [], pagination: res?.pagination ?? EMPTY_PAGINATION })

// ── Auth (public) ──────────────────────────────────────────────────────

/** @param {{ phone: string, channel: 'sms'|'email' }} payload @returns {Promise<{otpToken, channel, ttlMinutes, message}>} */
export const requestOtp = (payload) => portalHttp.post('/portal/auth/request-otp', payload, { auth: false })

/** @param {{ otpToken: string, code: string }} payload @returns {Promise<{token, expiresIn, client}>} */
export const verifyOtp = (payload) => portalHttp.post('/portal/auth/verify-otp', payload, { auth: false })

/** Active loan products (public). */
export const listPublicLoanProducts = async () => {
  const res = await portalHttp.get('/portal/public/loan-products', { auth: false })
  return res?.data ?? []
}

// ── Profile / dashboard ───────────────────────────────────────────────

export const getMe = async () => (await portalHttp.get('/portal/me'))?.data ?? null
export const updateMe = async (payload) => (await portalHttp.patch('/portal/me', payload))?.data
export const getDashboard = async () => (await portalHttp.get('/portal/me/dashboard'))?.data ?? null
export const getMyCreditScore = async () => (await portalHttp.get('/portal/me/credit-score'))?.data ?? null

// ── Loans ─────────────────────────────────────────────────────────────

export const listMyLoans = async (params) => page(await portalHttp.get('/portal/me/loans', { params: clean(params) }))
export const getMyLoan = async (id) => (await portalHttp.get(`/portal/me/loans/${id}`))?.data ?? null
export const getMyLoanSchedules = async (id) => (await portalHttp.get(`/portal/me/loans/${id}/schedules`))?.data ?? []
export const getMyLoanPayments = async (id) => (await portalHttp.get(`/portal/me/loans/${id}/payments`))?.data ?? []

/** Submit a loan request. Resolves to `{ message, data: { loan, scorePassed, riskScore, riskGrade, creditLimit } }`. */
export const submitLoanRequest = (payload) => portalHttp.post('/portal/loan-requests', payload)

// ── Co-signers ────────────────────────────────────────────────────────

/** Exact-phone lookup. Resolves to `{ coSignerToken, displayName, maskedPhone }`. */
export const lookupCoSigner = async (phone) => (await portalHttp.post('/portal/co-signers/lookup', { phone }))?.data

/** Nominate a (new) co-signer for an open loan; sends them a consent link. */
export const renominateCoSigner = (loanId, coSignerToken) =>
  portalHttp.put(`/portal/me/loans/${loanId}/co-signer`, { coSignerToken })

// Public consent page (opened from the co-signer's SMS/email link — no session).
export const getCoSignerConsent = async (token) =>
  (await portalHttp.get(`/portal/co-signer-consents/${encodeURIComponent(token)}`, { auth: false }))?.data
export const sendCoSignerConsentOtp = async (token, channel) =>
  (await portalHttp.post(`/portal/co-signer-consents/${encodeURIComponent(token)}/otp`, { channel }, { auth: false }))?.data
export const respondToCoSignerConsent = (token, payload) =>
  portalHttp.post(`/portal/co-signer-consents/${encodeURIComponent(token)}/respond`, payload, { auth: false })

// ── Payments ──────────────────────────────────────────────────────────

export const listMyPayments = async (params) => page(await portalHttp.get('/portal/me/payments', { params: clean(params) }))
export const listMyPaymentReports = async (params) => page(await portalHttp.get('/portal/payment-reports', { params: clean(params) }))
export const submitPaymentReport = (payload) => portalHttp.post('/portal/payment-reports', payload)

// ── KYC documents ────────────────────────────────────────────────────────────────

/** @returns {Promise<{ documents: object[], editable: boolean, uploadableTypes: string[] }>} */
export const listMyDocuments = async () =>
  (await portalHttp.get('/portal/me/documents'))?.data ?? { documents: [], editable: false, uploadableTypes: [] }

export const uploadMyDocument = ({ documentType, file }) => {
  const formData = new FormData()
  formData.append('documentType', documentType)
  formData.append('file', file)
  return portalHttp.post('/portal/me/documents', formData)
}

export const requestDocumentChange = (id, reason) =>
  portalHttp.post(`/portal/me/documents/${id}/change-request`, { reason })

/** Fetch one of the client's own documents as a Blob (sent with the session token). */
export const getMyDocumentBlob = (id) =>
  portalAxios.get(`/portal/me/documents/${id}/download`, { responseType: 'blob' })

export default {
  listMyDocuments,
  uploadMyDocument,
  requestDocumentChange,
  getMyDocumentBlob,
  requestOtp,
  verifyOtp,
  listPublicLoanProducts,
  getMe,
  updateMe,
  getDashboard,
  getMyCreditScore,
  listMyLoans,
  getMyLoan,
  getMyLoanSchedules,
  getMyLoanPayments,
  submitLoanRequest,
  lookupCoSigner,
  renominateCoSigner,
  getCoSignerConsent,
  sendCoSignerConsentOtp,
  respondToCoSignerConsent,
  listMyPayments,
  listMyPaymentReports,
  submitPaymentReport,
}
