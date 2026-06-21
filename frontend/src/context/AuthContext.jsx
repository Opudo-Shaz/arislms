/**
 * Authentication context.
 *
 * Holds the current session (token + user + role), exposes `login`/`logout`,
 * persists to localStorage, and wires the HTTP client's 401/403 handler so
 * expired/invalid sessions are cleared automatically.
 *
 * @module context/AuthContext
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { authApi, setUnauthorizedHandler } from '../api'
import {
  clearStoredAuth,
  decodeToken,
  getStoredAuth,
  setStoredAuth,
} from '../api/authStorage'

const AuthContext = createContext(undefined)

/**
 * Derive the numeric role id. Prefers the JWT claim (reliable) and falls back
 * to the user object returned by the login endpoint.
 * @param {string} token
 * @param {object} user
 * @returns {number|null}
 */
const resolveRole = (token, user) => {
  const claims = decodeToken(token)
  const role = claims?.role ?? user?.role ?? user?.role_id
  return role === undefined || role === null ? null : Number(role)
}

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(() => getStoredAuth())

  const logout = useCallback(() => {
    clearStoredAuth()
    setAuth(null)
  }, [])

  // Clear the session when the API reports the token is invalid/expired.
  useEffect(() => {
    setUnauthorizedHandler(() => logout())
    return () => setUnauthorizedHandler(null)
  }, [logout])

  const login = useCallback(async (email, password) => {
    const result = await authApi.login({ email, password })
    const session = {
      token: result.token,
      user: result.user,
      role: resolveRole(result.token, result.user),
      expiresIn: result.expiresIn,
    }
    setStoredAuth(session)
    setAuth(session)
    return session
  }, [])

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(auth?.token),
      token: auth?.token ?? null,
      user: auth?.user ?? null,
      role: auth?.role ?? null,
      login,
      logout,
    }),
    [auth, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

AuthProvider.propTypes = {
  children: PropTypes.node,
}

/**
 * Access the auth context.
 * @returns {{ isAuthenticated: boolean, token: string|null, user: object|null,
 *   role: number|null, login: Function, logout: Function }}
 */
export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}

export default AuthContext
