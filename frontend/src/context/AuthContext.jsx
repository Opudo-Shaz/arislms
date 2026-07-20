/**
 * Authentication context.
 *
 * Holds the current session (token + user + role), exposes `login`/`logout`,
 * persists to localStorage, and wires the HTTP client's 401/403 handler so
 * expired/invalid sessions are cleared automatically.
 *
 * @module context/AuthContext
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import Swal from 'sweetalert2'
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
  const sessionAlertShown = useRef(false)

  const logout = useCallback(() => {
    clearStoredAuth()
    setAuth(null)
  }, [])

  // Show a "session expired" alert on 401 — no automatic redirect.
  // clearStoredAuth() stops the bad token from being re-sent on future requests
  // without triggering the RequireAuth redirect (which would dismiss the alert).
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (sessionAlertShown.current) return
      sessionAlertShown.current = true
      clearStoredAuth()
      Swal.fire({
        icon: 'info',
        title: 'Session Expired',
        html: 'Your session has expired.<br/><a href="/login" style="color:#3b82f6;font-weight:600">Login again</a>',
        showConfirmButton: false,
        allowOutsideClick: true,
        didClose: () => {
          sessionAlertShown.current = false
          setAuth(null)
        },
      })
    })
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
