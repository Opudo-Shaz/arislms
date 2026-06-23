/**
 * Audits API.
 *
 * Wraps the backend `/audits` endpoints. The list endpoint returns a
 * `{ success, data, pagination }` envelope; this module returns
 * `{ logs, pagination }`. Entity/actor lookups return the `data` array.
 *
 * @module api/auditApi
 */

import http from './http'

/**
 * List audit logs (paginated, filtered).
 * @param {object} [params] { entityType, action, actorType, limit, offset }
 * @returns {Promise<{ logs:object[], pagination:{ total:number, limit:number, offset:number } }>}
 */
export const listAuditLogs = async (params = {}) => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  )
  const res = await http.get('/audits', { params: clean })
  return {
    logs: res?.data ?? [],
    pagination: res?.pagination ?? { total: 0, limit: 0, offset: 0 },
  }
}

/**
 * Audit logs for a specific entity.
 * @param {string} entityType @param {number|string} entityId @returns {Promise<object[]>}
 */
export const listEntityAuditLogs = async (entityType, entityId) => {
  const res = await http.get(`/audits/entity/${entityType}/${entityId}`)
  return res?.data ?? []
}

/**
 * Audit logs performed by a specific actor.
 * @param {number|string} actorId @returns {Promise<object[]>}
 */
export const listActorAuditLogs = async (actorId) => {
  const res = await http.get(`/audits/actor/${actorId}`)
  return res?.data ?? []
}

export default {
  listAuditLogs,
  listEntityAuditLogs,
  listActorAuditLogs,
}
