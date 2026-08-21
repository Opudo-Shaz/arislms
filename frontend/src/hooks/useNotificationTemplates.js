/**
 * TanStack Query hooks for the Notification Templates admin module.
 *
 * @module hooks/useNotificationTemplates
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import notificationTemplateApi from '../api/notificationTemplateApi'

export const notificationTemplateKeys = {
  all: ['notification-templates'],
  lists: () => [...notificationTemplateKeys.all, 'list'],
  detail: (id) => [...notificationTemplateKeys.all, 'detail', String(id)],
}

/** List all notification templates. */
export const useNotificationTemplates = () =>
  useQuery({
    queryKey: notificationTemplateKeys.lists(),
    queryFn: () => notificationTemplateApi.listNotificationTemplates(),
  })

/** Fetch a single notification template by id. */
export const useNotificationTemplate = (id) =>
  useQuery({
    queryKey: notificationTemplateKeys.detail(id),
    queryFn: () => notificationTemplateApi.getNotificationTemplate(id),
    enabled: Boolean(id),
  })

/** Create a notification template. */
export const useCreateNotificationTemplate = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => notificationTemplateApi.createNotificationTemplate(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationTemplateKeys.lists() }),
  })
}

/** Update a notification template. */
export const useUpdateNotificationTemplate = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }) => notificationTemplateApi.updateNotificationTemplate(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: notificationTemplateKeys.lists() })
      qc.invalidateQueries({ queryKey: notificationTemplateKeys.detail(id) })
    },
  })
}

/** Delete a notification template. */
export const useDeleteNotificationTemplate = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => notificationTemplateApi.deleteNotificationTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationTemplateKeys.lists() }),
  })
}
