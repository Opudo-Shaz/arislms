/**
 * Chart of Accounts API.
 *
 * Wraps the backend `/chart-of-accounts` endpoints. The HTTP layer unwraps the
 * axios response to the JSON body, so each call returns the inner `data`
 * payload from `{ success, data }`.
 *
 * @module api/chartOfAccountApi
 */

import http from './http'

/** @returns {Promise<object[]>} All active accounts. */
export const listAccounts = async () => {
  const res = await http.get('/chart-of-accounts')
  return res?.data ?? []
}

/** @param {number|string} id @returns {Promise<object>} */
export const getAccount = async (id) => {
  const res = await http.get(`/chart-of-accounts/${id}`)
  return res?.data ?? null
}

/**
 * Create an account.
 * @param {object} payload { code, name, type, normalBalance, description?, parentAccountId? }
 * @returns {Promise<object>}
 */
export const createAccount = async (payload) => {
  const res = await http.post('/chart-of-accounts', payload)
  return res?.data
}

/** @param {number|string} id @param {object} payload @returns {Promise<object>} */
export const updateAccount = async (id, payload) => {
  const res = await http.put(`/chart-of-accounts/${id}`, payload)
  return res?.data
}

/** Deactivate (soft-delete) an account. @param {number|string} id @returns {Promise<void>} */
export const deactivateAccount = async (id) => {
  await http.delete(`/chart-of-accounts/${id}`)
}

export default {
  listAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deactivateAccount,
}
