import http from './http'

const BASE = '/system-configs'

const unwrap = (res) => res.data

/** Keyset paginated (see ./pagination). Resolves to `{ success, data, pagination }`. */
export const listSystemConfigs = (params = {}) => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  )
  return http.get(BASE, { params: clean })
}

export const getSystemConfig = (id) =>
  http.get(`${BASE}/${id}`).then(unwrap)

export const createSystemConfig = (payload) =>
  http.post(BASE, payload).then(unwrap)

export const updateSystemConfig = (id, payload) =>
  http.put(`${BASE}/${id}`, payload).then(unwrap)

export const toggleSystemConfigStatus = (id) =>
  http.patch(`${BASE}/${id}/status`).then(unwrap)

export const deleteSystemConfig = (id) =>
  http.delete(`${BASE}/${id}`).then(unwrap)

export const revealSystemConfig = (id) =>
  http.get(`${BASE}/${id}/reveal`).then((res) => res.value)
