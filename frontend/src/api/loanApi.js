/**
 * Loans API.
 *
 * Wraps the backend `/loans` endpoints (CRUD + approve/disburse/principal).
 * The HTTP layer unwraps the axios response to the JSON body, so each call
 * here returns the inner `data` payload from `{ success, data }`.
 *
 * Repayment schedules, credit score, and collaterals are embedded in the loan
 * detail response (`repaymentSchedules`, `creditScore`, `collaterals`).
 *
 * @module api/loanApi
 */

import http from './http'

/** @returns {Promise<object[]>} All loans (admin/manager). */
export const listLoans = async () => {
  const res = await http.get('/loans')
  return res?.data ?? []
}

/** @returns {Promise<object[]>} Loans for the logged-in user. */
export const listMyLoans = async () => {
  const res = await http.get('/loans/my')
  return res?.data ?? []
}

/** @param {number|string} id @returns {Promise<object>} */
export const getLoan = async (id) => {
  const res = await http.get(`/loans/${id}`)
  return res?.data ?? null
}

/** Create a loan application; runs the backend credit-scoring pipeline. */
export const createLoan = async (payload) => {
  const res = await http.post('/loans', payload)
  return res?.data
}

/** @param {number|string} id @param {object} payload @returns {Promise<object>} */
export const updateLoan = async (id, payload) => {
  const res = await http.put(`/loans/${id}`, payload)
  return res?.data
}

/** @param {number|string} id @returns {Promise<object>} */
export const deleteLoan = async (id) => {
  const res = await http.delete(`/loans/${id}`)
  return res?.data
}

/** Approve a loan. @param {number|string} id @param {string} approvalDate YYYY-MM-DD */
export const approveLoan = async (id, approvalDate) => {
  const res = await http.post(`/loans/${id}/approve`, { approvalDate })
  return res?.data
}

/** Disburse an approved loan; generates the repayment schedule. */
export const disburseLoan = async (id, disbursementDate) => {
  const res = await http.post(`/loans/${id}/disburse`, { disbursementDate })
  return res?.data
}

/** Update the principal amount of a loan (admin only). */
export const updatePrincipal = async (id, newPrincipalAmount) => {
  const res = await http.put(`/loans/${id}/update_principal`, { newPrincipalAmount })
  return res?.data
}

export default {
  listLoans,
  listMyLoans,
  getLoan,
  createLoan,
  updateLoan,
  deleteLoan,
  approveLoan,
  disburseLoan,
  updatePrincipal,
}
