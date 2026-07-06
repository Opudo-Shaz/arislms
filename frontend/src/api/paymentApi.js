/**
 * Payments API.
 *
 * Wraps the backend `/payments` endpoints. The HTTP layer unwraps the axios
 * response to the JSON body, so each call returns the inner `data` payload
 * from `{ success, data }`.
 *
 * @module api/paymentApi
 */

import http from './http'

/** @returns {Promise<{payments:object[],pagination:object}>} Paginated payments (admin/manager). */
export const listPayments = async (params = {}) => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  )
  const res = await http.get('/payments', { params: clean })
  return { payments: res?.data ?? [], pagination: res?.pagination ?? { total: 0, page: 1, limit: 10, pages: 0 } }
}

/** @param {number|string} loanId @returns {Promise<object[]>} Payments for a loan. */
export const listPaymentsByLoan = async (loanId) => {
  const res = await http.get(`/payments/loan/${loanId}`)
  return res?.data ?? []
}

/**
 * Record a new payment.
 * @param {object} payload { clientId, loanId, amount, currency, paymentMethod,
 *   externalRef, payerName, payerPhone, transactionDate, notes }
 * @returns {Promise<object>} { payment, overpaymentCredit? }
 */
export const createPayment = async (payload) => {
  const res = await http.post('/payments', payload)
  return res?.data
}

/** @param {number|string} id @returns {Promise<object>} */
export const deletePayment = async (id) => {
  const res = await http.delete(`/payments/${id}`)
  return res?.data
}

export default {
  listPayments,
  listPaymentsByLoan,
  createPayment,
  deletePayment,
}
