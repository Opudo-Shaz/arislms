/**
 * TanStack Query hooks for staff review of client-reported payments.
 *
 * @module hooks/usePaymentReports
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import paymentReportApi from '../api/paymentReportApi'

export const paymentReportKeys = {
  all: ['paymentReports'],
  lists: (params) => [...paymentReportKeys.all, 'list', params],
}

export const usePaymentReports = (params = {}) =>
  useQuery({
    queryKey: paymentReportKeys.lists(params),
    queryFn: () => paymentReportApi.listPaymentReports(params),
    placeholderData: keepPreviousData,
  })

/** Amend / apply / reject. Applying records a payment, so loans + payments caches are refreshed too. */
export const usePaymentReportAction = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ action, id, payload }) => {
      if (action === 'amend') return paymentReportApi.amendPaymentReport(id, payload)
      if (action === 'apply') return paymentReportApi.applyPaymentReport(id, payload)
      if (action === 'reject') return paymentReportApi.rejectPaymentReport(id, payload)
      throw new Error(`Unknown action ${action}`)
    },
    onSuccess: (_data, { action }) => {
      qc.invalidateQueries({ queryKey: paymentReportKeys.all })
      if (action === 'apply') {
        qc.invalidateQueries({ queryKey: ['payments'] })
        qc.invalidateQueries({ queryKey: ['loans'] })
      }
    },
  })
}
