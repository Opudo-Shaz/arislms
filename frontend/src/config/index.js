/**
 * Application runtime configuration.
 *
 * Values are sourced from Vite environment variables (`import.meta.env`).
 * Copy `.env.example` to `.env.local` to override locally.
 *
 * @module config
 */

const config = {
  /** Base URL of the backend LMS API, including the `/api` prefix. */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002/api',
  /** localStorage key under which the auth session is persisted. */
  authStorageKey: 'arislms.auth',
}

export default config
