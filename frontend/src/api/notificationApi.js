/**
 * Notifications API.
 *
 * Wraps the backend `/notifications` endpoints (scoped to the logged-in user).
 * Responses use the `{ success, data }` envelope.
 *
 * @module api/notificationApi
 */

import http from './http'

/** @returns {Promise<object[]>} Notifications for the current user. */
export const listNotifications = async () => {
  const res = await http.get('/notifications')
  return res?.data ?? []
}

/**
 * Mark a notification as read.
 * @param {number|string} id
 * @returns {Promise<object>}
 */
export const markNotificationRead = async (id) => {
  const res = await http.put(`/notifications/${id}/read`)
  return res?.data
}

export default {
  listNotifications,
  markNotificationRead,
}
