/**
 * TanStack Query hooks for the Roles & Permissions admin module.
 *
 * @module hooks/useRoles
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import roleApi from '../api/roleApi'

export const roleKeys = {
  all: ['roles'],
  lists: () => [...roleKeys.all, 'list'],
  detail: (id) => [...roleKeys.all, 'detail', String(id)],
}

/** List all roles. */
export const useRoles = () =>
  useQuery({
    queryKey: roleKeys.lists(),
    queryFn: roleApi.listRoles,
  })

/** Fetch a single role by id. */
export const useRole = (id) =>
  useQuery({
    queryKey: roleKeys.detail(id),
    queryFn: () => roleApi.getRole(id),
    enabled: Boolean(id),
  })

/** Create a role. */
export const useCreateRole = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => roleApi.createRole(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: roleKeys.lists() }),
  })
}

/** Update a role (including its permissions array). */
export const useUpdateRole = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }) => roleApi.updateRole(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: roleKeys.lists() })
      qc.invalidateQueries({ queryKey: roleKeys.detail(id) })
    },
  })
}

/** Delete a role. */
export const useDeleteRole = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => roleApi.deleteRole(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: roleKeys.lists() }),
  })
}
