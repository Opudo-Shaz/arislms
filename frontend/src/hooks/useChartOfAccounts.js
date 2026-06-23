/**
 * TanStack Query hooks for the Chart of Accounts module.
 *
 * @module hooks/useChartOfAccounts
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import chartOfAccountApi from '../api/chartOfAccountApi'

export const accountKeys = {
  all: ['chartOfAccounts'],
  lists: () => [...accountKeys.all, 'list'],
  detail: (id) => [...accountKeys.all, 'detail', String(id)],
}

/** List all active accounts. */
export const useAccounts = () =>
  useQuery({
    queryKey: accountKeys.lists(),
    queryFn: chartOfAccountApi.listAccounts,
  })

/** Fetch a single account by id. */
export const useAccount = (id) =>
  useQuery({
    queryKey: accountKeys.detail(id),
    queryFn: () => chartOfAccountApi.getAccount(id),
    enabled: Boolean(id),
  })

/** Create an account. */
export const useCreateAccount = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => chartOfAccountApi.createAccount(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.lists() }),
  })
}

/** Update an account. */
export const useUpdateAccount = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }) => chartOfAccountApi.updateAccount(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: accountKeys.lists() })
      qc.invalidateQueries({ queryKey: accountKeys.detail(id) })
    },
  })
}

/** Deactivate an account. */
export const useDeactivateAccount = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => chartOfAccountApi.deactivateAccount(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.lists() }),
  })
}
