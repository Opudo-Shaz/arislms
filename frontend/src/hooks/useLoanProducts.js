/**
 * TanStack Query hooks for the Loan Products module.
 *
 * @module hooks/useLoanProducts
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import loanProductApi from '../api/loanProductApi'

export const loanProductKeys = {
  all: ['loanProducts'],
  lists: () => [...loanProductKeys.all, 'list'],
  detail: (id) => [...loanProductKeys.all, 'detail', String(id)],
}

/** List all loan products. */
export const useLoanProducts = () =>
  useQuery({
    queryKey: loanProductKeys.lists(),
    queryFn: loanProductApi.listLoanProducts,
  })

/** Fetch a single loan product by id. */
export const useLoanProduct = (id) =>
  useQuery({
    queryKey: loanProductKeys.detail(id),
    queryFn: () => loanProductApi.getLoanProduct(id),
    enabled: Boolean(id),
  })

/** Create a loan product. */
export const useCreateLoanProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => loanProductApi.createLoanProduct(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: loanProductKeys.lists() }),
  })
}

/** Update a loan product. */
export const useUpdateLoanProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }) => loanProductApi.updateLoanProduct(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: loanProductKeys.lists() })
      qc.invalidateQueries({ queryKey: loanProductKeys.detail(id) })
    },
  })
}

/** Delete a loan product. */
export const useDeleteLoanProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => loanProductApi.deleteLoanProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: loanProductKeys.lists() }),
  })
}
