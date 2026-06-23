/**
 * Roles API.
 *
 * Wraps the backend `/roles` endpoints. Responses use the `{ success, data }`
 * envelope, so calls return the inner `data` payload. Permissions are stored as
 * a JSONB string array and are managed by sending the full array via update.
 *
 * @module api/roleApi
 */

import http from './http'

/** @returns {Promise<object[]>} All roles. */
export const listRoles = async () => {
  const res = await http.get('/roles')
  return res?.data ?? []
}

/** @param {number|string} id @returns {Promise<object>} */
export const getRole = async (id) => {
  const res = await http.get(`/roles/${id}`)
  return res?.data ?? null
}

/**
 * Create a role.
 * @param {object} payload { name, description?, permissions?:string[], isActive? }
 * @returns {Promise<object>}
 */
export const createRole = async (payload) => {
  const res = await http.post('/roles', payload)
  return res?.data
}

/** @param {number|string} id @param {object} payload @returns {Promise<object>} */
export const updateRole = async (id, payload) => {
  const res = await http.put(`/roles/${id}`, payload)
  return res?.data
}

/** @param {number|string} id @returns {Promise<object>} */
export const deleteRole = async (id) => {
  const res = await http.delete(`/roles/${id}`)
  return res?.data
}

export default {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
}
