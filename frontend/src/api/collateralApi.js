/**
 * Collaterals API.
 *
 * Wraps the backend `/collaterals` endpoints. Collaterals are scoped to a loan
 * (`GET /collaterals/loan/:loanId`); lifecycle status is updated per record
 * (`PATCH /collaterals/:id/status`, admin only). The HTTP layer unwraps the
 * axios response to the JSON body.
 *
 * @module api/collateralApi
 */

import http from './http'

/** @param {number|string} loanId @returns {Promise<object[]>} Collaterals for a loan. */
export const listCollateralsByLoan = async (loanId) => {
  const res = await http.get(`/collaterals/loan/${loanId}`)
  return res?.data ?? []
}

/**
 * Update a collateral record's lifecycle status (admin only).
 * @param {number|string} id
 * @param {string} status One of pledged/verified/active/released/liquidated.
 * @param {string} [notes]
 * @returns {Promise<object>}
 */
export const updateCollateralStatus = async (id, status, notes) => {
  const res = await http.patch(`/collaterals/${id}/status`, { status, notes })
  return res?.data
}

/**
 * Update a collateral record's particulars (admin only).
 * @param {number|string} id
 * @param {object} data Fields: collateralType, description, referenceNumber, registrationNumber, estimatedValue, notes
 * @returns {Promise<object>}
 */
export const updateCollateralParticulars = async (id, data) => {
  const res = await http.patch(`/collaterals/${id}`, data)
  return res?.data
}

export default {
  listCollateralsByLoan,
  updateCollateralStatus,
  updateCollateralParticulars,
}
