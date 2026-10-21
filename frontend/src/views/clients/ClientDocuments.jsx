/**
 * ClientDocuments
 *
 * KYC documents card: lists all documents attached to a client and provides
 * an upload form. Wired to the backend /api/documents endpoints via TanStack Query.
 *
 * @module views/clients/ClientDocuments
 */

import React, { useRef, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CRow,
  CSpinner,
} from '@coreui/react'
import FormSelect from '../../components/FormSelect'
import CIcon from '@coreui/icons-react'
import { cilCheckCircle, cilCloudUpload, cilExternalLink, cilFile, cilReload, cilTrash, cilX } from '@coreui/icons'

import ConfirmModal from '../../components/ConfirmModal'
import StatusBadge from '../../components/StatusBadge'
import {
  DOCUMENT_TYPE,
  DOCUMENT_STATUS,
  DOCUMENT_VERIFICATION_STATUS,
  CLIENT_KYC_DOCUMENT_TYPES,
} from '../../constants/enums'
import { useClientDocuments, useUploadDocument, useDeleteDocument, useSetDocumentVerification } from '../../hooks/useDocuments'
import { useAuth } from '../../context/AuthContext'
import documentApi from '../../api/documentApi'
import { formatDate } from '../../utils/format'

const formatSize = (bytes) => {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const emptyForm = { documentType: 'national_id', description: '', file: null }

// Review dialogs: which verification status each action sets and how it's worded.
const REVIEW_ACTIONS = {
  verify: {
    title: 'Verify Document',
    status: 'verified',
    confirmText: 'Mark Verified',
    confirmColor: 'success',
    notesRequired: false,
    body: 'Mark this document as checked and valid?',
  },
  flag: {
    title: 'Request Re-upload',
    status: 'pending_reverification',
    confirmText: 'Request Re-upload',
    confirmColor: 'warning',
    notesRequired: true,
    notesLabel: 'What should the client fix? (shown to the client)',
    body: 'The client will be able to replace this document from the portal while their account is pending KYC reverification.',
  },
  approveChange: {
    title: 'Approve Change Request',
    status: 'pending_reverification',
    confirmText: 'Approve',
    confirmColor: 'primary',
    notesRequired: true,
    notesLabel: 'Instructions for the client (shown to the client)',
    body: 'Allow the client to upload a replacement for this document.',
  },
  declineChange: {
    title: 'Decline Change Request',
    status: 'verified',
    confirmText: 'Decline',
    confirmColor: 'danger',
    notesRequired: true,
    notesLabel: 'Reason',
    body: 'The current document stays on file as verified.',
  },
}

const ClientDocuments = ({ clientId, clientStatus }) => {
  const { data: documents = [], isLoading, error } = useClientDocuments(clientId)
  const uploadMutation  = useUploadDocument(clientId)
  const deleteMutation  = useDeleteDocument(clientId)
  const verifyMutation  = useSetDocumentVerification(clientId)
  const { hasPermission } = useAuth()
  const canUpload = hasPermission('documents:create')
  const canDelete = hasPermission('documents:delete')
  const canVerify = hasPermission('documents:verify')

  const [form, setForm]           = useState(emptyForm)
  const [formError, setFormError] = useState(null)
  const [openingId, setOpeningId] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [review, setReview] = useState(null) // { doc, action }
  const [moveClient, setMoveClient] = useState(false)
  const [reviewError, setReviewError] = useState(null)
  const fileInputRef = useRef(null)

  const reviewAction = review ? REVIEW_ACTIONS[review.action] : null
  const clientAlreadyReverifying = clientStatus === 'pending_kyc_reverification'

  const openReview = (doc, action) => {
    setReview({ doc, action })
    setMoveClient(!clientAlreadyReverifying && REVIEW_ACTIONS[action].status === 'pending_reverification')
    setReviewError(null)
  }

  const handleReview = async (notes) => {
    setReviewError(null)
    try {
      await verifyMutation.mutateAsync({
        id: review.doc.id,
        verificationStatus: reviewAction.status,
        notes: notes || null,
        requestClientReverification: reviewAction.status === 'pending_reverification' && moveClient,
      })
      setReview(null)
    } catch (err) {
      setReviewError(err?.data?.errors?.[0]?.message || err.message || 'Could not update the document')
    }
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0] || null
    setForm((f) => ({ ...f, file }))
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!form.file) { setFormError('Please choose a file to upload.'); return }
    setFormError(null)

    const fd = new FormData()
    fd.append('file', form.file)
    fd.append('documentType', form.documentType)
    fd.append('documentCategory', 'client_kyc')
    fd.append('clientId', clientId)
    if (form.description.trim()) fd.append('description', form.description.trim())

    try {
      await uploadMutation.mutateAsync(fd)
      setForm(emptyForm)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setFormError(err.message || 'Upload failed')
    }
  }

  const handleView = async (doc) => {
    setOpeningId(doc.id)
    try {
      await documentApi.openDocumentInTab(doc.id, doc.mimeType)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to open document', err)
    } finally {
      setOpeningId(null)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(confirmDeleteId)
    } finally {
      setConfirmDeleteId(null)
    }
  }

  return (
    <>
      <CCard className="mb-4">
        <CCardHeader>
          <strong>KYC Documents</strong>
          {documents.length > 0 && (
            <CBadge color="secondary" className="ms-2">{documents.length}</CBadge>
          )}
        </CCardHeader>
        <CCardBody>
          {isLoading && (
            <div className="text-center py-3">
              <CSpinner size="sm" color="primary" />
            </div>
          )}

          {!isLoading && error && (
            <CAlert color="danger" className="mb-3" dismissible>{error.message || 'Failed to load documents'}</CAlert>
          )}

          {!isLoading && !error && documents.length === 0 && (
            <p className="text-body-secondary mb-4">No documents uploaded yet.</p>
          )}

          {documents.length > 0 && (
            <div className="vstack gap-2 mb-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="d-flex align-items-start justify-content-between border rounded p-2"
                >
                  <div className="d-flex gap-2 overflow-hidden">
                    <CIcon icon={cilFile} size="lg" className="text-body-secondary mt-1 flex-shrink-0" />
                    <div className="overflow-hidden">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <StatusBadge enumDef={DOCUMENT_TYPE} value={doc.documentType} />
                        <StatusBadge enumDef={DOCUMENT_STATUS} value={doc.status} />
                        {doc.documentCategory === 'client_kyc' && doc.verificationStatus && (
                          <StatusBadge enumDef={DOCUMENT_VERIFICATION_STATUS} value={doc.verificationStatus} />
                        )}
                      </div>
                      <div
                        className="small text-truncate text-body-secondary mt-1"
                        title={doc.originalName}
                      >
                        {doc.originalName}
                        {doc.fileSize ? (
                          <span className="ms-2">{formatSize(doc.fileSize)}</span>
                        ) : null}
                      </div>
                      {doc.description && (
                        <div className="small text-body-secondary">{doc.description}</div>
                      )}
                      <div className="small text-body-secondary">{formatDate(doc.createdAt)}</div>
                      {doc.verificationNotes && doc.verificationStatus !== 'verified' && (
                        <div className="small text-warning-emphasis mt-1">{doc.verificationNotes}</div>
                      )}
                    </div>
                  </div>

                  <div className="d-flex gap-1 flex-shrink-0 ms-2">
                    {canVerify && doc.documentCategory === 'client_kyc' && (
                      <>
                        {doc.verificationStatus === 'change_requested' ? (
                          <>
                            <CButton size="sm" color="primary" variant="ghost" title="Approve change request" onClick={() => openReview(doc, 'approveChange')}>
                              <CIcon icon={cilCheckCircle} />
                            </CButton>
                            <CButton size="sm" color="danger" variant="ghost" title="Decline change request" onClick={() => openReview(doc, 'declineChange')}>
                              <CIcon icon={cilX} />
                            </CButton>
                          </>
                        ) : (
                          <>
                            {doc.verificationStatus !== 'verified' && (
                              <CButton size="sm" color="success" variant="ghost" title="Mark verified" onClick={() => openReview(doc, 'verify')}>
                                <CIcon icon={cilCheckCircle} />
                              </CButton>
                            )}
                            {doc.verificationStatus !== 'pending_reverification' && (
                              <CButton size="sm" color="warning" variant="ghost" title="Request re-upload" onClick={() => openReview(doc, 'flag')}>
                                <CIcon icon={cilReload} />
                              </CButton>
                            )}
                          </>
                        )}
                      </>
                    )}
                    <CButton
                      size="sm"
                      color="primary"
                      variant="ghost"
                      title="View / Download"
                      disabled={openingId === doc.id}
                      onClick={() => handleView(doc)}
                    >
                      {openingId === doc.id
                        ? <CSpinner size="sm" />
                        : <CIcon icon={cilExternalLink} />}
                    </CButton>
                    {canDelete && (
                      <CButton
                        size="sm"
                        color="danger"
                        variant="ghost"
                        title="Delete"
                        onClick={() => setConfirmDeleteId(doc.id)}
                      >
                        <CIcon icon={cilTrash} />
                      </CButton>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upload form */}
          {canUpload && (
          <CForm onSubmit={handleUpload}>
            <CRow className="g-3">
              <CCol md={5}>
                <CFormLabel>Document type</CFormLabel>
                <FormSelect
                  value={form.documentType}
                  onChange={(e) => setForm((f) => ({ ...f, documentType: e.target.value }))}
                >
                  {CLIENT_KYC_DOCUMENT_TYPES.map((v) => (
                    <option key={v} value={v}>{DOCUMENT_TYPE.labels[v]}</option>
                  ))}
                </FormSelect>
              </CCol>
              <CCol md={7}>
                <CFormLabel>File</CFormLabel>
                <CFormInput
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFile}
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx"
                />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Notes <span className="text-body-secondary">(optional)</span></CFormLabel>
                <CFormTextarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </CCol>
            </CRow>

            {formError && <div className="text-danger small mt-2">{formError}</div>}
            {uploadMutation.error && !formError && (
              <div className="text-danger small mt-2">
                {uploadMutation.error.message || 'Upload failed'}
              </div>
            )}

            <CButton
              type="submit"
              color="primary"
              className="mt-3"
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending
                ? <CSpinner size="sm" className="me-1" />
                : <CIcon icon={cilCloudUpload} className="me-1" />}
              Upload Document
            </CButton>
          </CForm>
          )}
        </CCardBody>
      </CCard>

      <ConfirmModal
        visible={Boolean(confirmDeleteId)}
        title="Delete Document"
        body="Delete this document? The file will be permanently removed."
        confirmText="Delete"
        confirmColor="danger"
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
        onClose={() => setConfirmDeleteId(null)}
      />

      <ConfirmModal
        visible={Boolean(review)}
        title={reviewAction?.title || ''}
        body={
          reviewAction ? (
            <>
              {reviewError && <CAlert color="danger">{reviewError}</CAlert>}
              <p className="mb-2">
                <strong>{DOCUMENT_TYPE.labels[review.doc.documentType] || review.doc.documentType}</strong>
                {' — '}
                {reviewAction.body}
              </p>
              {review.doc.verificationStatus === 'change_requested' && review.doc.verificationNotes && (
                <div className="small text-body-secondary mb-2">{review.doc.verificationNotes}</div>
              )}
              {reviewAction.status === 'pending_reverification' && (
                clientAlreadyReverifying ? (
                  <div className="small text-body-secondary">The client is already pending KYC reverification.</div>
                ) : (
                  <CFormCheck
                    id="doc-review-move-client"
                    label="Also set the client to Pending KYC Reverification (required for them to upload)"
                    checked={moveClient}
                    onChange={(e) => setMoveClient(e.target.checked)}
                  />
                )
              )}
            </>
          ) : null
        }
        confirmText={reviewAction?.confirmText || 'Confirm'}
        confirmColor={reviewAction?.confirmColor || 'primary'}
        withNotes
        notesLabel={reviewAction?.notesLabel || 'Notes'}
        notesRequired={Boolean(reviewAction?.notesRequired)}
        loading={verifyMutation.isPending}
        onConfirm={handleReview}
        onClose={() => setReview(null)}
      />
    </>
  )
}

ClientDocuments.propTypes = {
  clientId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  clientStatus: PropTypes.string,
}

export default ClientDocuments
