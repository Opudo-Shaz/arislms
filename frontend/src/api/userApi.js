/**
 * Users API.
 *
 * Wraps the backend `/users` endpoints. Note: unlike most modules, the user
 * controller returns plain DTOs/arrays (not a `{ success, data }` envelope),
 * so each call returns the HTTP body directly.
 *
 * @module api/userApi
 */

import http from './http'

/** @returns {Promise<object[]>} All users. */
export const listUsers = async () => {
  const res = await http.get('/users')
  return Array.isArray(res) ? res : []
}

/** @param {number|string} id @returns {Promise<object>} */
export const getUser = async (id) => {
  const res = await http.get(`/users/${id}`)
  return res ?? null
}

/**
 * Create a user.
 * @param {object} payload { first_name, middle_name?, last_name, email, phone?, role, id_number, password }
 * @returns {Promise<object>}
 */
export const createUser = async (payload) => http.post('/users', payload)

/** @param {number|string} id @param {object} payload @returns {Promise<object>} */
export const updateUser = async (id, payload) => http.put(`/users/${id}`, payload)

/** @param {number|string} id @returns {Promise<object>} */
export const deleteUser = async (id) => http.delete(`/users/${id}`)

/**
 * Reset a user's password (super admin / role 1 only).
 * @param {object} payload { userId, email, newPassword }
 * @returns {Promise<object>}
 */
export const resetUserPassword = async (payload) => http.post('/users/reset-password', payload)

/**
 * Change the currently logged-in user's own password.
 * @param {object} payload { currentPassword, newPassword }
 * @returns {Promise<object>}
 */
export const changePassword = async (payload) => http.post('/users/change-password', payload)

export const updateMe = async (id, payload) => http.put(`/users/${id}`, payload)

export default {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  updateMe,
  changePassword,
}
