/**
 * TanStack Query hooks for the client self-service portal.
 *
 * All keys live under `['portal']` so ClientAuthContext.logout can drop the
 * whole portal cache in one call.
 *
 * @module hooks/usePortal
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import portalApi from '../api/portalApi'

export const portalKeys = {
  all: ['portal'],
  me: () => [...portalKeys.all, 'me'],
  dashboard: () => [...portalKeys.all, 'dashboard'],
  creditScore: () => [...portalKeys.all, 'creditScore'],
  loans: (params) => [...portalKeys.all, 'loans', params],
  loan: (id) => [...portalKeys.all, 'loan', String(id)],
  loanSchedules: (id) => [...portalKeys.all, 'loan', String(id), 'schedules'],
  loanPayments: (id) => [...portalKeys.all, 'loan', String(id), 'payments'],
  payments: (params) => [...portalKeys.all, 'payments', params],
  paymentReports: (params) => [...portalKeys.all, 'paymentReports', params],
  products: () => [...portalKeys.all, 'products'],
}

export const usePortalMe = () => useQuery({ queryKey: portalKeys.me(), queryFn: portalApi.getMe })

export const usePortalDashboard = () =>
  useQuery({ queryKey: portalKeys.dashboard(), queryFn: portalApi.getDashboard })

export const usePortalLoans = (params = {}) =>
  useQuery({
    queryKey: portalKeys.loans(params),
    queryFn: () => portalApi.listMyLoans(params),
    placeholderData: keepPreviousData,
  })

export const usePortalLoan = (id) =>
  useQuery({ queryKey: portalKeys.loan(id), queryFn: () => portalApi.getMyLoan(id), enabled: Boolean(id) })

export const usePortalLoanSchedules = (id) =>
  useQuery({
    queryKey: portalKeys.loanSchedules(id),
    queryFn: () => portalApi.getMyLoanSchedules(id),
    enabled: Boolean(id),
  })

export const usePortalLoanPayments = (id) =>
  useQuery({
    queryKey: portalKeys.loanPayments(id),
    queryFn: () => portalApi.getMyLoanPayments(id),
    enabled: Boolean(id),
  })

export const usePortalPayments = (params = {}) =>
  useQuery({
    queryKey: portalKeys.payments(params),
    queryFn: () => portalApi.listMyPayments(params),
    placeholderData: keepPreviousData,
  })

export const usePortalPaymentReports = (params = {}) =>
  useQuery({
    queryKey: portalKeys.paymentReports(params),
    queryFn: () => portalApi.listMyPaymentReports(params),
    placeholderData: keepPreviousData,
  })

/** Active loan products (public endpoint — also used by the home page). */
export const usePublicLoanProducts = () =>
  useQuery({ queryKey: portalKeys.products(), queryFn: portalApi.listPublicLoanProducts, staleTime: 5 * 60 * 1000 })

export const useUpdatePortalMe = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => portalApi.updateMe(payload),
    onSuccess: (data) => qc.setQueryData(portalKeys.me(), data),
  })
}

export const useSubmitLoanRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => portalApi.submitLoanRequest(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: portalKeys.all }),
  })
}

export const useSubmitPaymentReport = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => portalApi.submitPaymentReport(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...portalKeys.all, 'paymentReports'] }),
  })
}

export const useRenominateCoSigner = (loanId) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (coSignerToken) => portalApi.renominateCoSigner(loanId, coSignerToken),
    onSuccess: () => qc.invalidateQueries({ queryKey: portalKeys.loan(loanId) }),
  })
}
