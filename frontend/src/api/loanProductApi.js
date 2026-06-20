/**
 * Loan Products API.
 *
 * Wraps the backend `/loan-products` endpoints. The HTTP layer unwraps the
 * axios response to the JSON body, so each call returns the inner `data`
 * payload from `{ success, data }`.
 *
 * @module api/loanProductApi
 */

import http from './http'

/** @returns {Promise<object[]>} All loan products. */
export const listLoanProducts = async () => {
  const res = await http.get('/loan-products')
  return res?.data ?? []
}

/** @param {number|string} id @returns {Promise<object>} */
export const getLoanProduct = async (id) => {
  const res = await http.get(`/loan-products/${id}`)
  return res?.data ?? null
}

/** @param {object} payload @returns {Promise<object>} */
export const createLoanProduct = async (payload) => {
  const res = await http.post('/loan-products', payload)
  return res?.data
}

/** @param {number|string} id @param {object} payload @returns {Promise<object>} */
export const updateLoanProduct = async (id, payload) => {
  const res = await http.put(`/loan-products/${id}`, payload)
  return res?.data
}

/** @param {number|string} id @returns {Promise<void>} */
export const deleteLoanProduct = async (id) => {
  await http.delete(`/loan-products/${id}`)
}

export default {
  listLoanProducts,
  getLoanProduct,
  createLoanProduct,
  updateLoanProduct,
  deleteLoanProduct,
}
