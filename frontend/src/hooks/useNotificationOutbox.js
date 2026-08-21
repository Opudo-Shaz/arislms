/**
 * TanStack Query hooks for the Notification Outbox admin module — delivery
 * queue visibility and manual retry of failed/skipped entries.
 *
 * @module hooks/useNotificationOutbox
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import notificationOutboxApi from '../api/notificationOutboxApi'

export const notificationOutboxKeys = {
  all: ['notification-outbox'],
  lists: () => [...notificationOutboxKeys.all, 'list'],
  list: (params) => [...notificationOutboxKeys.lists(), params],
  detail: (id) => [...notificationOutboxKeys.all, 'detail', String(id)],
}

/**
 * List outbox entries (paginated, filtered).
 * @param {{status?:string, channel?:string, eventKey?:string, page?:number, limit?:number}} [params]
 * @param {object} [options] Extra react-query options (e.g. refetchInterval).
 */
export const useNotificationOutbox = (params = {}, options = {}) =>
  useQuery({
    queryKey: notificationOutboxKeys.list(params),
    queryFn: () => notificationOutboxApi.listOutboxEntries(params),
    ...options,
  })

/** Re-queue a FAILED or SKIPPED outbox entry for immediate pickup. */
export const useRetryOutboxEntry = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => notificationOutboxApi.retryOutboxEntry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationOutboxKeys.lists() }),
  })
}
