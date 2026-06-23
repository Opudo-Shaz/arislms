/**
 * TanStack Query hooks for the Audit trail.
 *
 * @module hooks/useAudits
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import auditApi from '../api/auditApi'

export const auditKeys = {
  all: ['audits'],
  list: (params) => [...auditKeys.all, 'list', params],
}

/** List audit logs (paginated, filtered). */
export const useAuditLogs = (params = {}) =>
  useQuery({
    queryKey: auditKeys.list(params),
    queryFn: () => auditApi.listAuditLogs(params),
    placeholderData: keepPreviousData,
  })
