/**
 * TanStack Query client.
 *
 * Central cache/configuration for server state. Auth failures (401/403) are
 * handled by the HTTP layer's unauthorized handler, so retries are disabled
 * for those to avoid hammering the API after a session expires.
 *
 * @module lib/queryClient
 */

import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '../api'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
          return false
        }
        return failureCount < 2
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
})

export default queryClient
