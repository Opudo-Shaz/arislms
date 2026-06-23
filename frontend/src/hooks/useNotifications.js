/**
 * TanStack Query hooks for the Notifications module.
 *
 * @module hooks/useNotifications
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import notificationApi from '../api/notificationApi'

export const notificationKeys = {
  all: ['notifications'],
  lists: () => [...notificationKeys.all, 'list'],
}

/**
 * List the current user's notifications.
 * @param {object} [options] Extra react-query options (e.g. refetchInterval).
 */
export const useNotifications = (options = {}) =>
  useQuery({
    queryKey: notificationKeys.lists(),
    queryFn: notificationApi.listNotifications,
    ...options,
  })

/** Mark a notification as read. */
export const useMarkNotificationRead = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => notificationApi.markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.lists() }),
  })
}
