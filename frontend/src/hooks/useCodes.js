/**
 * TanStack Query hooks for the Codes admin module (config codes & code values
 * used to populate dropdown fields across the app).
 *
 * @module hooks/useCodes
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import codeApi from '../api/codeApi'

export const codeKeys = {
  all: ['codes'],
  lists: () => [...codeKeys.all, 'list'],
  detail: (id) => [...codeKeys.all, 'detail', String(id)],
  byKey: (key) => [...codeKeys.all, 'key', key],
  values: (codeId) => [...codeKeys.all, String(codeId), 'values'],
}

/** List all codes. */
export const useCodes = () =>
  useQuery({
    queryKey: codeKeys.lists(),
    queryFn: () => codeApi.listCodes(),
  })

/** Fetch a single code by id. */
export const useCode = (id) =>
  useQuery({
    queryKey: codeKeys.detail(id),
    queryFn: () => codeApi.getCode(id),
    enabled: Boolean(id),
  })

/**
 * Fetch a code (with active values) by its unique key — used to populate a dropdown.
 * @param {string} key
 * @param {{activeOnly?: boolean, enabled?: boolean}} [options]
 */
export const useCodeByKey = (key, { activeOnly = true, enabled = true } = {}) =>
  useQuery({
    queryKey: [...codeKeys.byKey(key), { activeOnly }],
    queryFn: () => codeApi.getCodeByKey(key, { activeOnly }),
    enabled: Boolean(key) && enabled,
    staleTime: 60_000,
  })

/** Create a code. */
export const useCreateCode = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => codeApi.createCode(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: codeKeys.lists() }),
  })
}

/** Update a code. */
export const useUpdateCode = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }) => codeApi.updateCode(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: codeKeys.lists() })
      qc.invalidateQueries({ queryKey: codeKeys.detail(id) })
      qc.invalidateQueries({ queryKey: codeKeys.all })
    },
  })
}

/** Delete a code. */
export const useDeleteCode = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => codeApi.deleteCode(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: codeKeys.lists() }),
  })
}

/** List values for a code. */
export const useCodeValues = (codeId, params = {}) =>
  useQuery({
    queryKey: [...codeKeys.values(codeId), params],
    queryFn: () => codeApi.listCodeValues(codeId, params),
    enabled: Boolean(codeId),
  })

/** Create a value under a code. */
export const useCreateCodeValue = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ codeId, payload }) => codeApi.createCodeValue(codeId, payload),
    onSuccess: (_data, { codeId }) => {
      qc.invalidateQueries({ queryKey: codeKeys.values(codeId) })
      qc.invalidateQueries({ queryKey: codeKeys.all })
    },
  })
}

/** Update a code value. Pass `codeId` in variables so the values list is invalidated. */
export const useUpdateCodeValue = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }) => codeApi.updateCodeValue(id, payload),
    onSuccess: (_data, { codeId }) => {
      if (codeId) qc.invalidateQueries({ queryKey: codeKeys.values(codeId) })
      qc.invalidateQueries({ queryKey: codeKeys.all })
    },
  })
}

/** Delete a code value. Pass `codeId` in variables so the values list is invalidated. */
export const useDeleteCodeValue = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }) => codeApi.deleteCodeValue(id),
    onSuccess: (_data, { codeId }) => {
      if (codeId) qc.invalidateQueries({ queryKey: codeKeys.values(codeId) })
      qc.invalidateQueries({ queryKey: codeKeys.all })
    },
  })
}
