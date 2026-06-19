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
 * Optional handler invoked when the API returns 401/403, allowing the app
 * to clear the session and redirect to login. Registered by the auth layer.
 * @type {((status: number) => void) | null}
 */
let unauthorizedHandler = null

/**
 * Register a callback invoked on 401/403 responses.
 * @param {(status: number) => void} handler
 */
export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler
}

/** Shared axios instance pointed at the API base URL. */
export const axiosInstance = axios.create({
  baseURL: config.apiBaseUrl,
  headers: { Accept: 'application/json' },
})

// Attach the bearer token unless the request opts out (`auth: false`).
axiosInstance.interceptors.request.use((requestConfig) => {
  if (requestConfig.auth !== false) {
    const token = getToken()
    if (token) {
      requestConfig.headers.Authorization = `Bearer ${token}`
    }
  }
  return requestConfig
})

// Normalize responses to their JSON body and errors to `ApiError`.
axiosInstance.interceptors.response.use(
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
    if ((status === 401 || status === 403) && unauthorizedHandler) {
      unauthorizedHandler(status)
    }
    const message =
      (data && (data.message || data.error)) || `Request failed with status ${status}`
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
export const request = (path, options = {}) => {
  const { method = 'GET', body, params, headers, auth = true, signal } = options
  return axiosInstance.request({
    url: path,
    method,
    data: body,
    params,
    headers,
    auth,
    signal,
  })
}

export const http = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
}

export default http
