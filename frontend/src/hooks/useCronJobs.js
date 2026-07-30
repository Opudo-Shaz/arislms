/**
 * TanStack Query hooks for the Cron Jobs admin module — visibility of
 * scheduled background jobs and admin-triggered manual runs.
 *
 * @module hooks/useCronJobs
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import cronApi from '../api/cronApi'

export const cronKeys = {
  all: ['cron-jobs'],
  lists: () => [...cronKeys.all, 'list'],
  runs: (key) => [...cronKeys.all, 'runs', key],
}

/** List registered cron jobs with metadata + last run. Refreshes while a job runs. */
export const useCronJobs = () =>
  useQuery({
    queryKey: cronKeys.lists(),
    queryFn: () => cronApi.listCronJobs(),
    refetchInterval: (query) =>
      Array.isArray(query.state.data) && query.state.data.some((j) => j.isRunning) ? 3000 : false,
  })

/** Recent run history for a job. */
export const useCronJobRuns = (key, { limit = 20, enabled = true } = {}) =>
  useQuery({
    queryKey: [...cronKeys.runs(key), { limit }],
    queryFn: () => cronApi.listCronJobRuns(key, { limit }),
    enabled: Boolean(key) && enabled,
  })

/** Manually trigger a job run; refreshes job list + that job's run history. */
export const useRunCronJob = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (key) => cronApi.runCronJob(key),
    onSuccess: (_data, key) => {
      qc.invalidateQueries({ queryKey: cronKeys.lists() })
      qc.invalidateQueries({ queryKey: cronKeys.runs(key) })
    },
  })
}
