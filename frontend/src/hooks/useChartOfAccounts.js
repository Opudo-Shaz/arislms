/**
 * TanStack Query hooks for the Chart of Accounts module.
 *
 * @module hooks/useChartOfAccounts
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import chartOfAccountApi from '../api/chartOfAccountApi'
import { getAccountStatement } from '../api/ledgerApi'

export const accountKeys = {
  all: ['chartOfAccounts'],
  lists: () => [...accountKeys.all, 'list'],
  detail: (id) => [...accountKeys.all, 'detail', String(id)],
  statement: (code, from, to) => [...accountKeys.all, 'statement', code, from, to],
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

/** Account statement (ledger lines) for a date range. */
export const useAccountStatement = (code, from, to) =>
  useQuery({
    queryKey: accountKeys.statement(code, from, to),
    queryFn: () => getAccountStatement(code, from, to),
    enabled: Boolean(code && from && to),
    staleTime: 0, // financial statement data should always be fresh
  })

/** Deactivate an account. */
export const useDeactivateAccount = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => chartOfAccountApi.deactivateAccount(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.lists() }),
  })
}
