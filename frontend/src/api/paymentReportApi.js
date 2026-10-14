/**
 * Client-reported payments — staff review (`/payment-reports`).
 *
 * @module api/paymentReportApi
 */

import http from './http'
import { EMPTY_PAGINATION } from './pagination'

/** @returns {Promise<{reports: object[], pagination: object}>} */
export const listPaymentReports = async (params = {}) => {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined))
  const res = await http.get('/payment-reports', { params: clean })
  return { reports: res?.data ?? [], pagination: res?.pagination ?? EMPTY_PAGINATION }
}

export const getPaymentReport = async (id) => (await http.get(`/payment-reports/${id}`))?.data ?? null

/** Amend a pending report (amount, externalRef, transactionDate, paymentMethod, payerPhone, notes). */
export const amendPaymentReport = async (id, payload) => (await http.patch(`/payment-reports/${id}`, payload))?.data

/** Confirm and record as a loan repayment. */
export const applyPaymentReport = async (id, reviewNotes) =>
  (await http.post(`/payment-reports/${id}/apply`, reviewNotes ? { reviewNotes } : {}))?.data

export const rejectPaymentReport = async (id, reason) =>
  (await http.post(`/payment-reports/${id}/reject`, { reason }))?.data

export default {
  listPaymentReports,
  getPaymentReport,
  amendPaymentReport,
  applyPaymentReport,
  rejectPaymentReport,
}
