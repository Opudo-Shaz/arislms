/**
 * HTTP client for the backend LMS API.
 *
 * Thin wrapper around `fetch` that:
 * - prefixes requests with the configured API base URL,
 * - attaches the `Authorization: Bearer <token>` header when authenticated,
 * - serializes/deserializes JSON,
 * - normalizes errors into an `ApiError`,
 * - notifies a registered handler on 401/403 (auth failures).
 *
 * @module api/http
 */

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

/**
 * Perform an API request.
 * @param {string} path - Path relative to the API base URL (e.g. `/clients`).
 * @param {object} [options]
 * @param {string} [options.method] - HTTP method (default `GET`).
 * @param {object} [options.body] - JSON-serializable request body.
 * @param {Record<string, string|number>} [options.params] - Query string params.
 * @param {Record<string, string>} [options.headers] - Extra headers.
 * @param {boolean} [options.auth=true] - Whether to attach the bearer token.
 * @returns {Promise<any>} Parsed JSON response (or `null` for 204).
 */
export const request = async (path, options = {}) => {
  const { method = 'GET', body, params, headers = {}, auth = true } = options

  let url = `${config.apiBaseUrl}${path}`
  if (params && Object.keys(params).length) {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, value)
      }
    })
    const qs = query.toString()
    if (qs) url += `?${qs}`
  }

  const finalHeaders = { Accept: 'application/json', ...headers }
  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json'
  }
  if (auth) {
    const token = getToken()
    if (token) finalHeaders.Authorization = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(url, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0, null)
  }

  if (response.status === 204) return null

  let data = null
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => null)
  } else {
    data = await response.text().catch(() => null)
  }

  if (!response.ok) {
    if ((response.status === 401 || response.status === 403) && unauthorizedHandler) {
      unauthorizedHandler(response.status)
    }
    const message =
      (data && (data.message || data.error)) || `Request failed with status ${response.status}`
    throw new ApiError(message, response.status, data)
  }

  return data
}

export const http = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
}

export default http
