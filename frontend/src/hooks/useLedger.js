/**
 * TanStack Query hooks for the Ledger (Journal Entries) module.
 *
 * Posting or reversing an entry changes account balances, so those mutations
 * also invalidate the trial balance.
 *
 * @module hooks/useLedger
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import ledgerApi from '../api/ledgerApi'

export const ledgerKeys = {
  all: ['ledger'],
  entries: (params) => [...ledgerKeys.all, 'entries', params],
  trialBalance: (asOf) => [...ledgerKeys.all, 'trialBalance', asOf ?? 'now'],
}

/** List journal entries (paginated, filtered). */
export const useJournalEntries = (params = {}) =>
  useQuery({
    queryKey: ledgerKeys.entries(params),
    queryFn: () => ledgerApi.listEntries(params),
    placeholderData: keepPreviousData,
  })

/** Trial balance as of an optional date. */
export const useTrialBalance = (asOf) =>
  useQuery({
    queryKey: ledgerKeys.trialBalance(asOf),
    queryFn: () => ledgerApi.getTrialBalance(asOf),
  })

/** Post a manual journal entry. */
export const useCreateJournalEntry = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => ledgerApi.createEntry(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ledgerKeys.all }),
  })
}

/** Reverse a posted journal entry. */
export const useReverseJournalEntry = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, description }) => ledgerApi.reverseEntry(id, description),
    onSuccess: () => qc.invalidateQueries({ queryKey: ledgerKeys.all }),
  })
}
