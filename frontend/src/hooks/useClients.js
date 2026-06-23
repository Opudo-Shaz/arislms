/**
 * TanStack Query hooks for the Clients module.
 *
 * Centralizes query keys, list/detail queries, and mutations (CRUD, KYC,
 * status transitions) with cache invalidation so screens stay in sync.
 *
 * @module hooks/useClients
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clientApi from '../api/clientApi'

export const clientKeys = {
  all: ['clients'],
  lists: () => [...clientKeys.all, 'list'],
  detail: (id) => [...clientKeys.all, 'detail', String(id)],
}

/** List clients (paginated + filtered). Returns {clients, pagination}. */
export const useClients = (params = {}, queryOptions = {}) =>
  useQuery({
    queryKey: [...clientKeys.lists(), params],
    queryFn: () => clientApi.listClients(params),
    placeholderData: keepPreviousData,
    ...queryOptions,
  })

/** Fetch a single client by id. */
export const useClient = (id) =>
  useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: () => clientApi.getClient(id),
    enabled: Boolean(id),
  })

/** Create a client. */
export const useCreateClient = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => clientApi.createClient(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientKeys.lists() }),
  })
}

/** Update a client. */
export const useUpdateClient = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }) => clientApi.updateClient(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: clientKeys.lists() })
      qc.invalidateQueries({ queryKey: clientKeys.detail(id) })
    },
  })
}

/** Delete a client. */
export const useDeleteClient = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => clientApi.deleteClient(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientKeys.lists() }),
  })
}

/**
 * KYC and status transitions. `action` is one of:
 * `verify`, `request-info`, `reject`, `activate`, `deactivate`,
 * `suspend`, `blacklist`.
 */
export const useClientAction = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action, notes }) => {
      switch (action) {
        case 'verify':
          return clientApi.verifyKyc(id, notes)
        case 'request-info':
          return clientApi.requestKycInfo(id, notes)
        case 'reject':
          return clientApi.rejectKyc(id, notes)
        default:
          return clientApi.changeClientStatus(id, action, notes)
      }
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: clientKeys.lists() })
      qc.invalidateQueries({ queryKey: clientKeys.detail(id) })
    },
  })
}
