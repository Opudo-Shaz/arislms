/**
 * TanStack Query hooks for Reports.
 *
 * @module hooks/useReports
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import reportApi from '../api/reportApi'

export const reportKeys = {
  all: ['reports'],
  portfolioAging: (asOf) => [...reportKeys.all, 'portfolioAging', asOf ?? 'now'],
  dashboardStats: ['reports', 'dashboardStats'],
}

/** Portfolio aging report as of an optional date. */
export const usePortfolioAging = (asOf) =>
  useQuery({
    queryKey: reportKeys.portfolioAging(asOf),
    queryFn: () => reportApi.getPortfolioAging(asOf),
    placeholderData: keepPreviousData,
  })

/** Aggregated KPIs and charts data for the dashboard. */
export const useDashboardStats = () =>
  useQuery({
    queryKey: reportKeys.dashboardStats,
    queryFn: () => reportApi.getDashboardStats(),
    staleTime: 60_000,
  })
