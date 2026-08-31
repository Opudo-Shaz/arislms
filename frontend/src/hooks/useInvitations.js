/**
 * TanStack Query hooks for invite-only registration links.
 *
 * @module hooks/useInvitations
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import invitationApi from '../api/invitationApi'
import { userKeys } from './useUsers'

export const invitationKeys = {
  all: ['invitations'],
  lists: () => [...invitationKeys.all, 'list'],
}

/** List invitations, optionally filtered by status. */
export const useInvitations = (params) =>
  useQuery({
    queryKey: [...invitationKeys.lists(), params],
    queryFn: () => invitationApi.listInvitations(params),
  })

/** Create (send) a new invitation. */
export const useCreateInvitation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => invitationApi.createInvitation(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: invitationKeys.lists() }),
  })
}

/** Resend a still-pending invitation. */
export const useResendInvitation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => invitationApi.resendInvitation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: invitationKeys.lists() }),
  })
}

/** Revoke a still-pending invitation. */
export const useRevokeInvitation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => invitationApi.revokeInvitation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: invitationKeys.lists() }),
  })
}

/** Verify an invitation token (public registration page prefill). */
export const useVerifyInvitation = (token) =>
  useQuery({
    queryKey: [...invitationKeys.all, 'verify', token],
    queryFn: () => invitationApi.verifyInvitation(token),
    enabled: Boolean(token),
    retry: false,
  })

/** Complete registration from an invite token (public). Invalidates the users list on success. */
export const useAcceptInvitation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => invitationApi.acceptInvitation(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.lists() }),
  })
}
