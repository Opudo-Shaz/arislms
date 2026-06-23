/**
 * TanStack Query hooks for the Member Contributions module.
 *
 * Recording a contribution/withdrawal auto-posts a journal entry, so the
 * mutation also invalidates the ledger cache.
 *
 * @module hooks/useMemberContributions
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import memberContributionApi from '../api/memberContributionApi'
import { ledgerKeys } from './useLedger'

export const contributionKeys = {
  all: ['memberContributions'],
  lists: () => [...contributionKeys.all, 'list'],
  byMember: (clientId) => [...contributionKeys.all, 'member', String(clientId)],
}

/** List all contributions and withdrawals. Returns {records, pagination}. */
export const useContributions = (params = {}) =>
  useQuery({
    queryKey: [...contributionKeys.lists(), params],
    queryFn: () => memberContributionApi.listContributions(params),
    placeholderData: keepPreviousData,
  })

/** Get a member's contribution statement. */
export const useMemberStatement = (clientId) =>
  useQuery({
    queryKey: contributionKeys.byMember(clientId),
    queryFn: () => memberContributionApi.getMemberStatement(clientId),
    enabled: Boolean(clientId),
  })

/** Record a contribution or withdrawal. */
export const useCreateContribution = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => memberContributionApi.createContribution(payload),
    onSuccess: (_data, payload) => {
      qc.invalidateQueries({ queryKey: contributionKeys.all })
      qc.invalidateQueries({ queryKey: ledgerKeys.all })
      if (payload?.clientId) {
        qc.invalidateQueries({ queryKey: contributionKeys.byMember(payload.clientId) })
      }
    },
  })
}
