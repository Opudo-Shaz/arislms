/**
 * Clients API.
 *
 * Wraps the backend `/clients` endpoints (CRUD + KYC + status transitions).
 * The HTTP layer unwraps the axios response to the JSON body, so each call
 * here returns the inner `data` payload from `{ success, data }`.
 *
 * @module api/clientApi
 */

import http from './http'

/** @returns {Promise<{clients: object[], pagination: object}>} Paginated clients. */
export const listClients = async (params = {}) => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  )
  const res = await http.get('/clients', { params: clean })
  return {
    clients: res?.data ?? [],
    pagination: res?.pagination ?? { total: 0, page: 1, limit: 20, pages: 0 },
  }
}

/** @param {number|string} id @returns {Promise<object>} */
export const getClient = async (id) => {
  const res = await http.get(`/clients/${id}`)
  return res?.data ?? null
}

/** @param {object} payload @returns {Promise<object>} */
export const createClient = async (payload) => {
  const res = await http.post('/clients', payload)
  return res?.data
}

/** @param {number|string} id @param {object} payload @returns {Promise<object>} */
export const updateClient = async (id, payload) => {
  const res = await http.put(`/clients/${id}`, payload)
  return res?.data
}

/** @param {number|string} id @returns {Promise<object>} */
export const deleteClient = async (id) => {
  const res = await http.delete(`/clients/${id}`)
  return res?.data
}

/** Verify KYC; client becomes active. @param {number|string} id @param {string} [notes] */
export const verifyKyc = async (id, notes) => {
  const res = await http.post(`/clients/${id}/kyc/verify`, { notes: notes || null })
  return res?.data
}

/** Request more KYC info; `kycNotes` required. @param {number|string} id @param {string} kycNotes */
export const requestKycInfo = async (id, kycNotes) => {
  const res = await http.post(`/clients/${id}/kyc/request-info`, { kycNotes })
  return res?.data
}

/** Reject KYC; client set to kyc_failed. @param {number|string} id @param {string} [notes] */
export const rejectKyc = async (id, notes) => {
  const res = await http.post(`/clients/${id}/kyc/reject`, { notes: notes || null })
  return res?.data
}

/** Generic status transition (activate/deactivate/suspend/blacklist). */
export const changeClientStatus = async (id, action, notes) => {
  const res = await http.post(`/clients/${id}/${action}`, { notes: notes || null })
  return res?.data
}

export default {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  verifyKyc,
  requestKycInfo,
  rejectKyc,
  changeClientStatus,
}
