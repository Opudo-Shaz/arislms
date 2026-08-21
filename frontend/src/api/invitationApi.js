/**
 * Invitations API (invite-only registration links).
 *
 * Admin/manager endpoints use the standard `{ success, data }` envelope.
 * The public verify/accept endpoints (no auth) are used by the invitee-facing
 * registration page.
 *
 * @module api/invitationApi
 */

import http from './http'

/**
 * Create (send) a new invitation.
 * @param {object} payload { email, role, first_name?, middle_name?, last_name?, phone? }
 * @returns {Promise<{ invitation: object, inviteUrl: string, warnings: string[] }>}
 */
export const createInvitation = async (payload) => {
  const res = await http.post('/invitations', payload)
  return { invitation: res?.data, inviteUrl: res?.inviteUrl, warnings: res?.warnings || [] }
}

/**
 * List invitations, optionally filtered by status.
 * @param {{ status?: string }} [params]
 * @returns {Promise<object[]>}
 */
export const listInvitations = async (params = {}) => {
  const res = await http.get('/invitations', { params })
  return res?.data ?? []
}

/**
 * Resend a still-pending invitation (regenerates the token/expiry).
 * @param {number|string} id
 * @returns {Promise<{ invitation: object, inviteUrl: string, warnings: string[] }>}
 */
export const resendInvitation = async (id) => {
  const res = await http.post(`/invitations/${id}/resend`)
  return { invitation: res?.data, inviteUrl: res?.inviteUrl, warnings: res?.warnings || [] }
}

/**
 * Revoke a still-pending invitation.
 * @param {number|string} id
 * @returns {Promise<object>}
 */
export const revokeInvitation = async (id) => {
  const res = await http.post(`/invitations/${id}/revoke`)
  return res?.data
}

/**
 * Verify an invitation token and fetch prefill data for the registration page.
 * PUBLIC — no auth.
 * @param {string} token
 * @returns {Promise<object>}
 */
export const verifyInvitation = async (token) => {
  const res = await http.get('/invitations/verify', { params: { token }, auth: false })
  return res?.data
}

/**
 * Complete registration from an invite token.
 * PUBLIC — no auth.
 * @param {object} payload { token, first_name, middle_name?, last_name, phone?, id_number?, password }
 * @returns {Promise<object>}
 */
export const acceptInvitation = async (payload) => http.post('/invitations/accept', payload, { auth: false })

export default {
  createInvitation,
  listInvitations,
  resendInvitation,
  revokeInvitation,
  verifyInvitation,
  acceptInvitation,
}
