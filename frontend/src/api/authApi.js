/**
 * Authentication API.
 * @module api/authApi
 */

import http from './http'

/**
 * Authenticate a user.
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ message: string, token: string, expiresIn: number, user: object }>}
 */
export const login = (credentials) => http.post('/auth/login', credentials, { auth: false })

/**
 * Request a self-service password reset email.
 * Always resolves — backend never reveals whether the email exists.
 * @param {string} email
 */
export const forgotPassword = (email) =>
  http.post('/auth/forgot-password', { email }, { auth: false })

/**
 * Consume a reset token and set a new password.
 * @param {string} token
 * @param {string} newPassword
 */
export const resetPassword = (token, newPassword) =>
  http.post('/auth/reset-password', { token, newPassword }, { auth: false })

export default { login, forgotPassword, resetPassword }
