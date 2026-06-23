/**
 * TanStack Query hooks for Credit Scores.
 *
 * @module hooks/useCreditScores
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import creditScoreApi from '../api/creditScoreApi'
import { clientKeys } from './useClients'

export const creditScoreKeys = {
  all: ['creditScores'],
  byClient: (clientId) => [...creditScoreKeys.all, 'client', String(clientId)],
}

/** Fetch the most recent credit score for a client. */
export const useClientCreditScore = (clientId) =>
  useQuery({
    queryKey: creditScoreKeys.byClient(clientId),
    queryFn: () => creditScoreApi.getCreditScoreByClient(clientId),
    enabled: Boolean(clientId),
  })

/** Refresh the credit score for a client. Invalidates both the credit score and client detail caches. */
export const useRefreshCreditScore = (clientId) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => creditScoreApi.refreshCreditScore(clientId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: creditScoreKeys.byClient(clientId) })
      qc.invalidateQueries({ queryKey: clientKeys.detail(clientId) })
    },
  })
}
