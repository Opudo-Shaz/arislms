/**
 * Reports API.
 *
 * Wraps the backend `/reports` endpoints. Responses use the `{ success, data }`
 * envelope, so calls return the inner `data` payload.
 *
 * @module api/reportApi
 */

import http from './http'

/**
 * Portfolio aging report: outstanding principal bucketed by days overdue.
 * @param {string} [asOf] YYYY-MM-DD; defaults to today on the server.
 * @returns {Promise<{ asOf:string, buckets:object[], totals:object }>}
 */
export const getPortfolioAging = async (asOf) => {
  const res = await http.get('/reports/portfolio-aging', { params: asOf ? { asOf } : {} })
  return res?.data ?? { asOf: null, buckets: [], totals: { principalOutstanding: 0, count: 0 } }
}

export default {
  getPortfolioAging,
}
