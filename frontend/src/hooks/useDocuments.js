/**
 * TanStack Query hooks for Documents.
 *
 * @module hooks/useDocuments
 */

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import documentApi from '../api/documentApi'
import { clientKeys } from './useClients'

export const documentKeys = {
  all: ['documents'],
  byClient: (clientId) => [...documentKeys.all, 'client', String(clientId)],
  byLoan: (loanId) => [...documentKeys.all, 'loan', String(loanId)],
  byUser: (userId) => [...documentKeys.all, 'user', String(userId)],
  blob: (id) => [...documentKeys.all, 'blob', String(id)],
}

/** List all documents for a client (excludes deleted). */
export const useClientDocuments = (clientId) =>
  useQuery({
    queryKey: documentKeys.byClient(clientId),
    queryFn: () => documentApi.listClientDocuments(clientId),
    enabled: Boolean(clientId),
  })

/** List all documents for a loan (excludes deleted). */
export const useLoanDocuments = (loanId) =>
  useQuery({
    queryKey: documentKeys.byLoan(loanId),
    queryFn: () => documentApi.listLoanDocuments(loanId),
    enabled: Boolean(loanId),
  })

/**
 * Fetch a single document as a Blob and return a stable object URL.
 * The object URL is revoked when the component unmounts or the id changes.
 */
export const useDocumentBlobUrl = (documentId) => {
  const { data: blob } = useQuery({
    queryKey: documentKeys.blob(documentId),
    queryFn: () => documentApi.downloadDocumentBlob(documentId),
    enabled: Boolean(documentId),
    staleTime: 5 * 60 * 1000,
  })

  const [objectUrl, setObjectUrl] = useState(null)

  useEffect(() => {
    if (!blob) { setObjectUrl(null); return }
    const url = URL.createObjectURL(blob)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [blob])

  return objectUrl
}

/** Upload a document. Invalidates the relevant client or loan list on success. */
export const useUploadDocument = (clientId, loanId) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (formData) => documentApi.uploadDocument(formData),
    onSuccess: () => {
      if (clientId) qc.invalidateQueries({ queryKey: documentKeys.byClient(clientId) })
      if (loanId)   qc.invalidateQueries({ queryKey: documentKeys.byLoan(loanId) })
    },
  })
}

/** Soft-delete a document. Invalidates the relevant list on success. */
export const useDeleteDocument = (clientId, loanId) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => documentApi.deleteDocument(id),
    onSuccess: () => {
      if (clientId) qc.invalidateQueries({ queryKey: documentKeys.byClient(clientId) })
      if (loanId)   qc.invalidateQueries({ queryKey: documentKeys.byLoan(loanId) })
    },
  })
}

/** Verify / flag a client KYC document. May also move the client to reverification, so refresh the client too. */
export const useSetDocumentVerification = (clientId) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => documentApi.setDocumentVerification(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentKeys.byClient(clientId) })
      qc.invalidateQueries({ queryKey: clientKeys.all })
    },
  })
}

/** List all documents for a user (e.g. profile photo). */
export const useUserDocuments = (userId) =>
  useQuery({
    queryKey: documentKeys.byUser(userId),
    queryFn: () => documentApi.listUserDocuments(userId),
    enabled: Boolean(userId),
  })

/** Upload a user profile document (photo). Invalidates user document list on success. */
export const useUploadUserDocument = (userId) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (formData) => documentApi.uploadDocument(formData),
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: documentKeys.byUser(userId) })
    },
  })
}
