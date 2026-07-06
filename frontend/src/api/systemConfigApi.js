import http from './http'

const BASE = '/system-configs'

const unwrap = (res) => res.data

export const listSystemConfigs = (params = {}) =>
  http.get(BASE, { params })

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
