/**
 * TanStack Query hooks for the Users admin module.
 *
 * @module hooks/useUsers
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import userApi from '../api/userApi'

export const userKeys = {
  all: ['users'],
  lists: () => [...userKeys.all, 'list'],
  detail: (id) => [...userKeys.all, 'detail', String(id)],
}

/** List all users. */
export const useUsers = () =>
  useQuery({
    queryKey: userKeys.lists(),
    queryFn: userApi.listUsers,
  })

/** Fetch a single user by id. */
export const useUser = (id) =>
  useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => userApi.getUser(id),
    enabled: Boolean(id),
  })

/** Create a user. */
export const useCreateUser = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => userApi.createUser(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.lists() }),
  })
}

/** Update a user. */
export const useUpdateUser = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }) => userApi.updateUser(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: userKeys.lists() })
      qc.invalidateQueries({ queryKey: userKeys.detail(id) })
    },
  })
}

/** Delete a user. */
export const useDeleteUser = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => userApi.deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.lists() }),
  })
}

/** Reset a user's password (admin only). */
export const useResetUserPassword = () =>
  useMutation({
    mutationFn: (payload) => userApi.resetUserPassword(payload),
  })

/** Update current user's own profile (self-service). */
export const useUpdateMe = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }) => userApi.updateMe(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: userKeys.lists() })
      qc.invalidateQueries({ queryKey: userKeys.detail(id) })
    },
  })
}

/** Change own password. */
export const useChangePassword = () =>
  useMutation({
    mutationFn: (payload) => userApi.changePassword(payload),
  })
