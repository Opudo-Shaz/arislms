/**
 * Codes API.
 *
 * Wraps the backend `/codes` endpoints (config codes + code values used to
 * populate dropdown fields). Responses use the `{ success, data }` envelope,
 * so calls return the inner `data` payload.
 *
 * @module api/codeApi
 */

import http from './http'

const BASE = '/codes'

/** @param {{includeValues?: boolean}} [params] @returns {Promise<object[]>} All codes. */
export const listCodes = async (params = {}) => {
  const res = await http.get(BASE, { params })
  return res?.data ?? []
}

/** @param {number|string} id @returns {Promise<object>} */
export const getCode = async (id) => {
  const res = await http.get(`${BASE}/${id}`)
  return res?.data ?? null
}

/**
 * Fetch a code (with its active values, sorted) by its unique key.
 * @param {string} key - e.g. 'GENDER'
 * @param {{activeOnly?: boolean}} [params]
 * @returns {Promise<object>}
 */
export const getCodeByKey = async (key, params = {}) => {
  const res = await http.get(`${BASE}/key/${key}`, { params })
  return res?.data ?? null
}

/**
 * Create a code.
 * @param {object} payload { key, name, description?, isActive? }
 * @returns {Promise<object>}
 */
export const createCode = async (payload) => {
  const res = await http.post(BASE, payload)
  return res?.data
}

/** @param {number|string} id @param {object} payload @returns {Promise<object>} */
export const updateCode = async (id, payload) => {
  const res = await http.put(`${BASE}/${id}`, payload)
  return res?.data
}

/** @param {number|string} id @returns {Promise<object>} */
export const deleteCode = async (id) => {
  const res = await http.delete(`${BASE}/${id}`)
  return res?.data
}

/** @param {number|string} codeId @param {{activeOnly?: boolean}} [params] @returns {Promise<object[]>} */
export const listCodeValues = async (codeId, params = {}) => {
  const res = await http.get(`${BASE}/${codeId}/values`, { params })
  return res?.data ?? []
}

/**
 * Create a value under a code.
 * @param {number|string} codeId
 * @param {object} payload { value, description?, sortOrder?, isActive? }
 * @returns {Promise<object>}
 */
export const createCodeValue = async (codeId, payload) => {
  const res = await http.post(`${BASE}/${codeId}/values`, payload)
  return res?.data
}

/** @param {number|string} valueId @param {object} payload @returns {Promise<object>} */
export const updateCodeValue = async (valueId, payload) => {
  const res = await http.put(`${BASE}/values/${valueId}`, payload)
  return res?.data
}

/** @param {number|string} valueId @returns {Promise<object>} */
export const deleteCodeValue = async (valueId) => {
  const res = await http.delete(`${BASE}/values/${valueId}`)
  return res?.data
}

/**
 * Validate that a submitted value matches one of a code's active values.
 * @param {string} key - The code key (e.g. 'GENDER')
 * @param {string} value - The submitted value
 * @returns {Promise<boolean>}
 */
export const validateCodeValue = async (key, value) => {
  const res = await http.post(`${BASE}/${key}/validate`, { value })
  return res?.data?.valid ?? false
}

export default {
  listCodes,
  getCode,
  getCodeByKey,
  createCode,
  updateCode,
  deleteCode,
  listCodeValues,
  createCodeValue,
  updateCodeValue,
  deleteCodeValue,
  validateCodeValue,
}
