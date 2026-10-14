/**
 * Member Contributions API.
 *
 * Wraps the backend `/member-contributions` endpoints. The HTTP layer unwraps
 * the axios response to the JSON body, so each call returns the inner `data`
 * payload from `{ success, data }`.
 *
 * @module api/memberContributionApi
 */

import http from './http'
import { EMPTY_PAGINATION } from './pagination'

/** @returns {Promise<{records:object[],pagination:object}>} Keyset-paginated contributions. */
export const listContributions = async (params = {}) => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  )
  const res = await http.get('/member-contributions', { params: clean })
  return { records: res?.data ?? [], pagination: res?.pagination ?? EMPTY_PAGINATION }
}

/**
 * Get a member's contribution history with running totals.
 * @param {number|string} clientId
 * @returns {Promise<{ client:object, totalContributions:number, totalWithdrawals:number, netBalance:number, records:object[] }>}
 */
export const getMemberStatement = async (clientId) => {
  const res = await http.get(`/member-contributions/member/${clientId}`)
  return res?.data ?? null
}

/**
 * Record a contribution or withdrawal (auto-posts a balanced journal entry).
 * @param {object} payload { clientId, amount, contributionDate?, type, notes? }
 * @returns {Promise<object>}
 */
export const createContribution = async (payload) => {
  const res = await http.post('/member-contributions', payload)
  return res?.data
}

export default {
  listContributions,
  getMemberStatement,
  createContribution,
}
