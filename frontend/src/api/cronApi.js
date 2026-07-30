/**
 * Cron Jobs API.
 *
 * Wraps the backend `/cron-jobs` endpoints for admin visibility and manual
 * runs of scheduled background jobs. Responses use the `{ success, data }`
 * envelope, so calls return the inner `data` payload.
 *
 * @module api/cronApi
 */

import http from './http'

const BASE = '/cron-jobs'

/** @returns {Promise<object[]>} Registered jobs with metadata + last run. */
export const listCronJobs = async () => {
  const res = await http.get(BASE)
  return res?.data ?? []
}

/**
 * Recent run history for a job (newest first).
 * @param {string} key - job key (e.g. 'loan-status')
 * @param {{limit?: number}} [params]
 * @returns {Promise<object[]>}
 */
export const listCronJobRuns = async (key, params = {}) => {
  const res = await http.get(`${BASE}/${key}/runs`, { params })
  return res?.data ?? []
}

/**
 * Manually trigger a job run (admin only).
 * @param {string} key - job key
 * @returns {Promise<object>} run result
 */
export const runCronJob = async (key) => {
  const res = await http.post(`${BASE}/${key}/run`)
  return res?.data
}

export default {
  listCronJobs,
  listCronJobRuns,
  runCronJob,
}
