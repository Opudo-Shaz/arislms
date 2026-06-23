/**
 * Credit Scores API.
 *
 * Wraps the backend `/credit-scores` endpoints. The HTTP layer unwraps the
 * axios response to the JSON body.
 *
 * @module api/creditScoreApi
 */

import http from './http'

/** Most recent credit score for a client. @param {number|string} clientId */
export const getCreditScoreByClient = async (clientId) => {
  const res = await http.get(`/credit-scores/client/${clientId}`)
  return res?.data ?? null
}

/** Trigger a credit score refresh for a client. @param {number|string} clientId */
export const refreshCreditScore = async (clientId) => {
  const res = await http.post(`/clients/${clientId}/credit-score/refresh`)
  return res?.data ?? null
}

export default {
  getCreditScoreByClient,
  refreshCreditScore,
}
