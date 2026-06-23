/**
 * TanStack Query hooks for the Payments module.
 *
 * Recording or deleting a payment mutates loan balances and repayment
 * schedules, so those mutations also invalidate the loans cache.
 *
 * @module hooks/usePayments
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import paymentApi from '../api/paymentApi'
import { loanKeys } from './useLoans'

export const paymentKeys = {
  all: ['payments'],
  lists: () => [...paymentKeys.all, 'list'],
  byLoan: (loanId) => [...paymentKeys.all, 'loan', String(loanId)],
}

/** List all payments (admin/manager). Returns {payments, pagination}. */
export const usePayments = (params = {}) =>
  useQuery({
    queryKey: [...paymentKeys.lists(), params],
    queryFn: () => paymentApi.listPayments(params),
    placeholderData: keepPreviousData,
  })

/** List payments for a single loan. */
export const useLoanPayments = (loanId) =>
  useQuery({
    queryKey: paymentKeys.byLoan(loanId),
    queryFn: () => paymentApi.listPaymentsByLoan(loanId),
    enabled: Boolean(loanId),
  })

/** Record a new payment; invalidates payments and the affected loan. */
export const useCreatePayment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => paymentApi.createPayment(payload),
    onSuccess: (_data, payload) => {
      qc.invalidateQueries({ queryKey: paymentKeys.all })
      qc.invalidateQueries({ queryKey: loanKeys.all })
      if (payload?.loanId) {
        qc.invalidateQueries({ queryKey: loanKeys.detail(payload.loanId) })
      }
    },
  })
}

/** Delete a payment; invalidates payments and loans. */
export const useDeletePayment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => paymentApi.deletePayment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: paymentKeys.all })
      qc.invalidateQueries({ queryKey: loanKeys.all })
    },
  })
}
