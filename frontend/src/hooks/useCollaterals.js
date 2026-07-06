/**
 * TanStack Query hooks for the Collaterals module.
 *
 * Collaterals are fetched per loan. Updating a collateral status also affects
 * the loan detail response (which embeds collaterals), so the loan detail
 * cache is invalidated.
 *
 * @module hooks/useCollaterals
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import collateralApi from '../api/collateralApi'
import { loanKeys } from './useLoans'

export const collateralKeys = {
  all: ['collaterals'],
  byLoan: (loanId) => [...collateralKeys.all, 'loan', String(loanId)],
}

/** List collaterals for a loan. */
export const useLoanCollaterals = (loanId) =>
  useQuery({
    queryKey: collateralKeys.byLoan(loanId),
    queryFn: () => collateralApi.listCollateralsByLoan(loanId),
    enabled: Boolean(loanId),
  })

/**
 * Update a collateral record's particulars (admin only).
 * Pass `{ id, data, loanId }`; `loanId` is used for cache invalidation.
 */
export const useUpdateCollateralParticulars = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) =>
      collateralApi.updateCollateralParticulars(id, data),
    onSuccess: (_data, { loanId }) => {
      if (loanId) {
        qc.invalidateQueries({ queryKey: collateralKeys.byLoan(loanId) })
        qc.invalidateQueries({ queryKey: loanKeys.detail(loanId) })
      } else {
        qc.invalidateQueries({ queryKey: collateralKeys.all })
      }
    },
  })
}

/**
 * Update a collateral record's status (admin only).
 * Pass `{ id, status, notes, loanId }`; `loanId` is used for cache invalidation.
 */
export const useUpdateCollateralStatus = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, notes }) =>
      collateralApi.updateCollateralStatus(id, status, notes),
    onSuccess: (_data, { loanId }) => {
      if (loanId) {
        qc.invalidateQueries({ queryKey: collateralKeys.byLoan(loanId) })
        qc.invalidateQueries({ queryKey: loanKeys.detail(loanId) })
      } else {
        qc.invalidateQueries({ queryKey: collateralKeys.all })
      }
    },
  })
}
