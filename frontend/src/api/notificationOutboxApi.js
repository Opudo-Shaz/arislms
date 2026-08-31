/**
 * Notification Outbox API (admin).
 *
 * Wraps the backend `/notification-outbox` endpoints — visibility into the
 * notification delivery queue and manual retry of failed/skipped entries.
 * The list endpoint returns a `{ success, total, page, limit, data }`
 * envelope; this module returns `{ rows, total, page, limit }`.
 *
 * @module api/notificationOutboxApi
 */

import http from './http'

const BASE = '/notification-outbox'

/**
 * List outbox entries (paginated, filtered).
 * @param {object} [params] { status, channel, eventKey, page, limit }
 * @returns {Promise<{ rows:object[], total:number, page:number, limit:number }>}
 */
export const listOutboxEntries = async (params = {}) => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  )
  const res = await http.get(BASE, { params: clean })
  return {
    rows: res?.data ?? [],
    total: res?.total ?? 0,
    page: res?.page ?? 1,
    limit: res?.limit ?? 20,
  }
}

/** @param {number|string} id @returns {Promise<object>} */
export const getOutboxEntry = async (id) => {
  const res = await http.get(`${BASE}/${id}`)
  return res?.data ?? null
}

/**
 * Re-queue a FAILED or SKIPPED outbox entry for immediate pickup.
 * @param {number|string} id
 * @returns {Promise<object>}
 */
export const retryOutboxEntry = async (id) => {
  const res = await http.post(`${BASE}/${id}/retry`)
  return res?.data
}

export default {
  listOutboxEntries,
  getOutboxEntry,
  retryOutboxEntry,
}
