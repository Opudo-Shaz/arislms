/**
 * TanStack Query hooks for the Loans module.
 *
 * Centralizes query keys, list/detail queries, and mutations (CRUD, approve,
 * disburse, principal update) with cache invalidation so screens stay in sync.
 *
 * @module hooks/useLoans
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import loanApi from '../api/loanApi'

export const loanKeys = {
  all: ['loans'],
  lists: () => [...loanKeys.all, 'list'],
  mine: () => [...loanKeys.all, 'mine'],
  detail: (id) => [...loanKeys.all, 'detail', String(id)],
}

/** List all loans (admin/manager). */
export const useLoans = () =>
  useQuery({
    queryKey: loanKeys.lists(),
    queryFn: loanApi.listLoans,
  })

/** List loans belonging to the logged-in user. */
export const useMyLoans = () =>
  useQuery({
    queryKey: loanKeys.mine(),
    queryFn: loanApi.listMyLoans,
  })

/** Fetch a single loan by id (includes schedule, credit score, collaterals). */
export const useLoan = (id) =>
  useQuery({
    queryKey: loanKeys.detail(id),
    queryFn: () => loanApi.getLoan(id),
    enabled: Boolean(id),
  })

/** Create a loan application (runs credit scoring). */
export const useCreateLoan = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => loanApi.createLoan(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: loanKeys.all }),
  })
}

/** Update a loan. */
export const useUpdateLoan = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }) => loanApi.updateLoan(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: loanKeys.lists() })
      qc.invalidateQueries({ queryKey: loanKeys.detail(id) })
    },
  })
}

/** Delete a loan. */
export const useDeleteLoan = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => loanApi.deleteLoan(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: loanKeys.all }),
  })
}

/**
 * Lifecycle actions: approve, disburse, principal update.
 * `action` is one of `approve`, `disburse`, `principal`.
 */
export const useLoanAction = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action, value }) => {
      switch (action) {
        case 'approve':
          return loanApi.approveLoan(id, value)
        case 'disburse':
          return loanApi.disburseLoan(id, value)
        case 'principal':
          return loanApi.updatePrincipal(id, value)
        default:
          throw new Error(`Unknown loan action: ${action}`)
      }
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: loanKeys.lists() })
      qc.invalidateQueries({ queryKey: loanKeys.detail(id) })
    },
  })
}
