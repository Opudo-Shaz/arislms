/**
 * HTTP client for the client self-service portal (`/api/portal`).
 *
 * A separate instance from the staff client (api/http.js): it sends the
 * client session token (stored under `config.portalAuthStorageKey`) and has
 * its own 401 handler, so staff and client sessions never mix.
 *
 * @module api/portalHttp
 */

import config from '../config'
import { createApiClient } from './http'
import { getStoredAuth } from './authStorage'

/** Backend code sent when a signed-in client's portal access has been withdrawn. */
export const PORTAL_ACCESS_DENIED = 'PORTAL_ACCESS_DENIED'

const portalClient = createApiClient({
  getToken: () => getStoredAuth(config.portalAuthStorageKey)?.token ?? null,
  // Besides an expired token, a 403 PORTAL_ACCESS_DENIED (account suspended,
  // portal turned off, ...) ends the session too.
  endsSession: (status, data) => status === 401 || (status === 403 && data?.code === PORTAL_ACCESS_DENIED),
})

export const setPortalUnauthorizedHandler = portalClient.setUnauthorizedHandler
export const portalHttp = portalClient.http

export default portalHttp
