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
import { EMPTY_PAGINATION } from './pagination'

const BASE = '/notification-outbox'

/**
 * List outbox entries (keyset paginated, filtered).
 * @param {object} [params] { status, channel, eventKey, cursor, direction, limit }
 * @returns {Promise<{ rows:object[], pagination:object }>}
 */
export const listOutboxEntries = async (params = {}) => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  )
  const res = await http.get(BASE, { params: clean })
  return {
    rows: res?.data ?? [],
    pagination: res?.pagination ?? EMPTY_PAGINATION,
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
