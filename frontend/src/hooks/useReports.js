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
}

/** Portfolio aging report as of an optional date. */
export const usePortfolioAging = (asOf) =>
  useQuery({
    queryKey: reportKeys.portfolioAging(asOf),
    queryFn: () => reportApi.getPortfolioAging(asOf),
    placeholderData: keepPreviousData,
  })
