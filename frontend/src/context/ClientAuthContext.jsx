/**
 * Client self-service portal authentication context.
 *
 * The client-portal counterpart of AuthContext: passwordless phone + OTP
 * login, a session persisted under its own storage key, and its own 401
 * handling. Staff and client sessions are fully independent — a browser can
 * hold either (or both) without one leaking into the other's requests.
 *
 * @module context/ClientAuthContext
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import config from '../config'
import portalApi from '../api/portalApi'
import { setPortalUnauthorizedHandler } from '../api/portalHttp'
import { clearStoredAuth, getStoredAuth, setStoredAuth } from '../api/authStorage'
import queryClient from '../lib/queryClient'

const KEY = config.portalAuthStorageKey
/** sessionStorage key carrying a sign-out reason to the portal login page. */
export const PORTAL_NOTICE_KEY = 'arislms.portal.notice'

const ClientAuthContext = createContext(undefined)

export const ClientAuthProvider = ({ children }) => {
  const [session, setSession] = useState(() => getStoredAuth(KEY))

  const logout = useCallback(() => {
    clearStoredAuth(KEY)
    setSession(null)
    // Drop cached portal data so the next client to sign in on this device starts clean.
    queryClient.removeQueries({ queryKey: ['portal'] })
  }, [])

  // An expired/revoked token or withdrawn portal access ends the session;
  // RequireClientAuth then sends the client back to the portal login, which
  // shows the reason the backend gave (e.g. account suspended).
  useEffect(() => {
    setPortalUnauthorizedHandler((status, data) => {
      try {
        if (status === 403 && data?.message) sessionStorage.setItem(PORTAL_NOTICE_KEY, data.message)
      } catch {
        // storage unavailable — the login page just won't show the reason
      }
      logout()
    })
    return () => setPortalUnauthorizedHandler(null)
  }, [logout])

  const startSession = useCallback((result) => {
    const next = { token: result.token, client: result.client, expiresIn: result.expiresIn }
    setStoredAuth(next, KEY)
    setSession(next)
    return next
  }, [])

  /** Step 1 — send a login code. @returns {Promise<{otpToken, channel, ttlMinutes, message}>} */
  const requestOtp = useCallback((phone, channel) => portalApi.requestOtp({ phone, channel }), [])

  /** Step 2 — verify the code. Resolves `{ stepUpRequired, stepUpToken }` on an unrecognised device, else starts the session. */
  const verifyOtp = useCallback(async (otpToken, code) => {
    const result = await portalApi.verifyOtp({ otpToken, code })
    if (result.stepUpRequired) return { stepUpRequired: true, stepUpToken: result.stepUpToken }
    return startSession(result)
  }, [startSession])

  /** Step 3 (new devices) — confirm with the last digits of the ID number, then start the session. */
  const verifyDevice = useCallback(async (stepUpToken, idLast4) => {
    const result = await portalApi.verifyDevice({ stepUpToken, idLast4 })
    return startSession(result)
  }, [startSession])

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(session?.token),
      client: session?.client ?? null,
      requestOtp,
      verifyOtp,
      verifyDevice,
      logout,
    }),
    [session, requestOtp, verifyOtp, verifyDevice, logout],
  )

  return <ClientAuthContext.Provider value={value}>{children}</ClientAuthContext.Provider>
}

ClientAuthProvider.propTypes = {
  children: PropTypes.node,
}

/** @returns {{ isAuthenticated: boolean, client: object|null, requestOtp: Function, verifyOtp: Function, verifyDevice: Function, logout: Function }} */
export const useClientAuth = () => {
  const ctx = useContext(ClientAuthContext)
  if (ctx === undefined) {
    throw new Error('useClientAuth must be used within a ClientAuthProvider')
  }
  return ctx
}

export default ClientAuthContext
