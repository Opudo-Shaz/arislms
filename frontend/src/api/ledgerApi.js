/**
 * Ledger (Journal Entries) API.
 *
 * Wraps the backend `/ledger` endpoints. The list endpoint is keyset
 * paginated (see ./pagination); `listEntries` returns `{ entries, pagination }`.
 *
 * @module api/ledgerApi
 */

import http from './http'
import { EMPTY_PAGINATION } from './pagination'

/**
 * List journal entries (keyset paginated, newest entry date first).
 * @param {object} [params] { sourceType, from, to, cursor, direction, limit }
 * @returns {Promise<{ entries:object[], pagination:object }>}
 */
export const listEntries = async (params = {}) => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  )
  const res = await http.get('/ledger/entries', { params: clean })
  return {
    entries: res?.data ?? [],
    pagination: res?.pagination ?? EMPTY_PAGINATION,
  }
}

/**
 * Post a manual, balanced journal entry.
 * @param {object} payload { entryDate, description?, sourceType, lines:[{ accountCode, debit?, credit?, description? }] }
 * @returns {Promise<object>} The posted entry with lines.
 */
export const createEntry = async (payload) => {
  const res = await http.post('/ledger/entries', payload)
  return res?.data
}

/**
 * Reverse a posted journal entry.
 * @param {number|string} id
 * @param {string} [description]
 * @returns {Promise<{ original:object, reversal:object }>}
 */
export const reverseEntry = async (id, description) => {
  const res = await http.post(`/ledger/entries/${id}/reverse`, { description })
  return res?.data
}

/**
 * Get the trial balance.
 * @param {string} [asOf] YYYY-MM-DD; include only entries on or before this date.
 * @returns {Promise<{ accounts:object[], grandDebit:number, grandCredit:number, balanced:boolean }>}
 */
export const getTrialBalance = async (asOf) => {
  const res = await http.get('/ledger/trial-balance', { params: asOf ? { asOf } : {} })
  return res?.data ?? { accounts: [], grandDebit: 0, grandCredit: 0, balanced: true }
}

/**
 * Get account statement (ledger lines for a single account).
 * @param {string} code  Account code
 * @param {string} [from] YYYY-MM-DD
 * @param {string} [to]   YYYY-MM-DD
 * @returns {Promise<{ account:object, rows:object[] }>}
 */
export const getAccountStatement = async (code, from, to) => {
  const params = {}
  if (from) params.from = from
  if (to) params.to = to
  const res = await http.get(`/ledger/accounts/${encodeURIComponent(code)}/statement`, { params })
  return res?.data ?? { account: null, rows: [] }
}

export default {
  listEntries,
  createEntry,
  reverseEntry,
  getTrialBalance,
  getAccountStatement,
}
