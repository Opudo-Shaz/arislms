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

export default { login }
