/**
 * TanStack Query hooks for client registration links.
 *
 * @module hooks/useClientRegistrationLinks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/clientRegistrationLinkApi'
import clientApi from '../api/clientApi'

export const registrationLinkKeys = {
  all: ['client-registration-links'],
  lists: () => [...registrationLinkKeys.all, 'list'],
  detail: (id) => [...registrationLinkKeys.all, 'detail', id],
}

export const useRegistrationLinks = (params) =>
  useQuery({
    queryKey: [...registrationLinkKeys.lists(), params],
    queryFn: () => api.listLinks(params),
  })

export const useRegistrationLink = (id) =>
  useQuery({
    queryKey: registrationLinkKeys.detail(id),
    queryFn: () => api.getLink(id),
    enabled: Boolean(id),
  })

export const useCreateRegistrationLink = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => api.createLink(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: registrationLinkKeys.lists() }),
  })
}

export const useRevokeRegistrationLink = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.revokeLink(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: registrationLinkKeys.all }),
  })
}

/** Whether creating a client requires phone verification (system config, staff form). */
export const useClientRegistrationConfig = (enabled = true) =>
  useQuery({
    queryKey: ['client-registration-config'],
    queryFn: () => clientApi.getRegistrationConfig(),
    enabled,
    staleTime: 60_000,
  })

/** Public registration page: is this link still usable? (no auth) */
export const useResolveRegistrationLink = (token) =>
  useQuery({
    queryKey: [...registrationLinkKeys.all, 'resolve', token],
    queryFn: () => api.resolveLink(token),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  })
