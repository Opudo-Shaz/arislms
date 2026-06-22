/**
 * Documents API.
 *
 * Wraps the backend `/documents` endpoints (upload, list, download, update, delete).
 * Regular calls go through the shared `http` helper (auth + JSON normalisation).
 * The download call uses `axiosInstance` directly so it can request a Blob response.
 *
 * @module api/documentApi
 */

import http from './http'
import { axiosInstance } from './http'

/** @param {number|string} clientId @returns {Promise<object[]>} */
export const listClientDocuments = async (clientId) => {
  const res = await http.get(`/documents/client/${clientId}`)
  return res?.data ?? []
}

/** @param {number|string} loanId @returns {Promise<object[]>} */
export const listLoanDocuments = async (loanId) => {
  const res = await http.get(`/documents/loan/${loanId}`)
  return res?.data ?? []
}

/**
 * Upload a document.
 * @param {FormData} formData - Must include: file, documentType, documentCategory,
 *   and at least one of clientId | loanId | collateralId.
 * @returns {Promise<object>}
 */
export const uploadDocument = async (formData) => {
  // Axios detects FormData and sets the correct multipart/form-data Content-Type.
  const res = await http.post('/documents', formData)
  return res?.data
}

/**
 * Fetch a document file as a Blob (requires auth).
 * Suitable for opening in a new tab via URL.createObjectURL().
 * @param {number|string} id
 * @returns {Promise<Blob>}
 */
export const downloadDocumentBlob = async (id) => {
  // axiosInstance is used directly to pass responseType:'blob'.
  // The response interceptor returns response.data, which for blob requests is the Blob.
  return axiosInstance.get(`/documents/${id}/download`, { responseType: 'blob' })
}

/**
 * Open a document in a new browser tab.
 * Fetches the file with auth, creates a temporary object URL, and opens it.
 * @param {number|string} id
 * @param {string} [mimeType]
 */
export const openDocumentInTab = async (id, mimeType) => {
  const blob = await downloadDocumentBlob(id)
  const typedBlob = mimeType ? new Blob([blob], { type: mimeType }) : blob
  const url = URL.createObjectURL(typedBlob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 15_000)
}

/** @param {number|string} id @param {object} data @returns {Promise<object>} */
export const updateDocument = async (id, data) => {
  const res = await http.patch(`/documents/${id}`, data)
  return res?.data
}

/** @param {number|string} id @returns {Promise<object>} */
export const deleteDocument = async (id) => {
  const res = await http.delete(`/documents/${id}`)
  return res?.data
}

const documentApi = {
  listClientDocuments,
  listLoanDocuments,
  uploadDocument,
  downloadDocumentBlob,
  openDocumentInTab,
  updateDocument,
  deleteDocument,
}

export default documentApi
