/**
 * Notification Templates API (admin).
 *
 * Wraps the backend `/notification-templates` endpoints — CRUD for per-event,
 * per-channel notification templates. Responses use the `{ success, data }`
 * envelope, so calls return the inner `data` payload.
 *
 * @module api/notificationTemplateApi
 */

import http from './http'

const BASE = '/notification-templates'

/** @returns {Promise<object[]>} All notification templates. */
export const listNotificationTemplates = async () => {
  const res = await http.get(BASE)
  return res?.data ?? []
}

/** @param {number|string} id @returns {Promise<object>} */
export const getNotificationTemplate = async (id) => {
  const res = await http.get(`${BASE}/${id}`)
  return res?.data ?? null
}

/**
 * Create a notification template.
 * @param {object} payload { eventKey, description?, emailSubject?, emailBody?, smsBody?,
 *   pushTitle?, pushBody?, inAppTitle?, inAppBody?, emailEnabled?, smsEnabled?, pushEnabled?,
 *   inAppEnabled?, isActive? }
 * @returns {Promise<object>}
 */
export const createNotificationTemplate = async (payload) => {
  const res = await http.post(BASE, payload)
  return res?.data
}

/** @param {number|string} id @param {object} payload @returns {Promise<object>} */
export const updateNotificationTemplate = async (id, payload) => {
  const res = await http.put(`${BASE}/${id}`, payload)
  return res?.data
}

/** @param {number|string} id @returns {Promise<object>} */
export const deleteNotificationTemplate = async (id) => {
  const res = await http.delete(`${BASE}/${id}`)
  return res?.data
}

export default {
  listNotificationTemplates,
  getNotificationTemplate,
  createNotificationTemplate,
  updateNotificationTemplate,
  deleteNotificationTemplate,
}
