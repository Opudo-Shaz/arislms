/**
 * HTTP client for the backend LMS API.
 *
 * Axios instance that:
 * - prefixes requests with the configured API base URL,
 * - attaches the `Authorization: Bearer <token>` header when authenticated,
 * - serializes/deserializes JSON,
 * - normalizes errors into an `ApiError`,
 * - notifies a registered handler on 401/403 (auth failures).
 *
 * @module api/http
 */

import axios from 'axios'
import config from '../config'
import { getToken } from './authStorage'

/** Error thrown for non-2xx API responses. */
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

/**
 * Build an API client bound to a token source. The staff portal and the
 * client self-service portal each get their own instance (separate tokens,
 * separate 401 handling) so the two sessions never mix.
 *
 * @param {object} opts
 * @param {() => (string|null)} opts.getToken - returns the bearer token to send
 * @param {(status: number, data: any) => boolean} [opts.endsSession] - which error
 *   responses end the session and trigger the unauthorized handler (default: 401)
 * @returns {{ axiosInstance: import('axios').AxiosInstance, request: Function,
 *   http: object, setUnauthorizedHandler: Function }}
 */
export const createApiClient = ({ getToken: readToken, endsSession = (status) => status === 401 }) => {
  /**
   * Optional handler invoked when a response ends the session (401 by
   * default, see `endsSession`), allowing the app to clear the session and
   * redirect to login. Registered by the auth layer.
   * @type {((status: number, data: any) => void) | null}
   */
  let unauthorizedHandler = null

  /** Register a callback invoked on 401 responses. */
  const setUnauthorizedHandler = (handler) => {
    unauthorizedHandler = handler
  }

  const instance = axios.create({
    baseURL: config.apiBaseUrl,
    headers: { Accept: 'application/json' },
  })

  // Attach the bearer token unless the request opts out (`auth: false`).
  instance.interceptors.request.use((requestConfig) => {
    if (!requestConfig.skipAuth) {
      const token = readToken()
      if (token) {
        requestConfig.headers.Authorization = `Bearer ${token}`
      }
    }
    return requestConfig
  })

  // Normalize responses to their JSON body and errors to `ApiError`.
  instance.interceptors.response.use(
    (response) => response.data ?? null,
    (error) => {
      if (axios.isCancel(error)) {
        return Promise.reject(new ApiError(error.message || 'Request cancelled', 0, null))
      }

      const response = error.response
      if (!response) {
        return Promise.reject(new ApiError(error.message || 'Network error', 0, null))
      }

      const { status, data } = response
      const msg = (data && (data.message || data.error)) || ''
      // 401 = invalid/expired token; 403 = authenticated but wrong role.
      // Skip the global session-expired handler for requests that were never
      // authenticated to begin with (e.g. wrong credentials on /auth/login) —
      // those 401s are handled locally by the caller, not as a session timeout.
      if (endsSession(status, data) && unauthorizedHandler && !error.config?.skipAuth) {
        unauthorizedHandler(status, data)
      }
      const message = msg || `Request failed with status ${status}`
      return Promise.reject(new ApiError(message, status, data))
    },
  )

  /**
   * Perform an API request.
   * @param {string} path - Path relative to the API base URL (e.g. `/clients`).
   * @param {object} [options]
   * @param {string} [options.method] - HTTP method (default `GET`).
   * @param {object} [options.body] - JSON-serializable request body.
   * @param {Record<string, string|number>} [options.params] - Query string params.
   * @param {Record<string, string>} [options.headers] - Extra headers.
   * @param {boolean} [options.auth=true] - Whether to attach the bearer token.
   * @param {AbortSignal} [options.signal] - Optional abort signal.
   * @returns {Promise<any>} Parsed JSON response (or `null` for 204).
   */
  const doRequest = (path, options = {}) => {
    const { method = 'GET', body, params, headers, auth = true, signal } = options
    return instance.request({
      url: path,
      method,
      data: body,
      params,
      headers,
      skipAuth: auth === false,
      signal,
    })
  }

  const client = {
    get: (path, options) => doRequest(path, { ...options, method: 'GET' }),
    post: (path, body, options) => doRequest(path, { ...options, method: 'POST', body }),
    put: (path, body, options) => doRequest(path, { ...options, method: 'PUT', body }),
    patch: (path, body, options) => doRequest(path, { ...options, method: 'PATCH', body }),
    delete: (path, options) => doRequest(path, { ...options, method: 'DELETE' }),
  }

  return { axiosInstance: instance, request: doRequest, http: client, setUnauthorizedHandler }
}

/** Staff (management portal) API client. */
const staffClient = createApiClient({ getToken })

export const { axiosInstance, request, setUnauthorizedHandler } = staffClient
export const http = staffClient.http

export default http
