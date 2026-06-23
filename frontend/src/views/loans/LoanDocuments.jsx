/**
 * LoanDocuments
 *
 * Supporting documents card for a loan: lists all documents attached to the
 * loan (collateral docs, bank statements, payslips, etc.) and provides an
 * upload form. Mirrors the ClientDocuments pattern.
 *
 * @module views/loans/LoanDocuments
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
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCloudUpload, cilExternalLink, cilFile, cilTrash } from '@coreui/icons'

import ConfirmModal from '../../components/ConfirmModal'
import StatusBadge from '../../components/StatusBadge'
import { DOCUMENT_TYPE, DOCUMENT_STATUS, LOAN_DOCUMENT_TYPES } from '../../constants/enums'
import { useLoanDocuments, useUploadDocument, useDeleteDocument } from '../../hooks/useDocuments'
import documentApi from '../../api/documentApi'
import { formatDate } from '../../utils/format'

const formatSize = (bytes) => {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const emptyForm = { documentType: 'title_deed', documentCategory: 'loan_collateral', description: '', file: null }

const CATEGORY_OPTIONS = [
  { value: 'loan_collateral', label: 'Collateral' },
  { value: 'loan_supporting', label: 'Supporting' },
]

const LoanDocuments = ({ loanId }) => {
  const { data: documents = [], isLoading, error } = useLoanDocuments(loanId)
  const uploadMutation = useUploadDocument(null, loanId)
  const deleteMutation = useDeleteDocument(null, loanId)

  const [form, setForm]           = useState(emptyForm)
  const [formError, setFormError] = useState(null)
  const [openingId, setOpeningId] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const fileInputRef = useRef(null)

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

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
    fd.append('documentCategory', form.documentCategory)
    fd.append('loanId', loanId)
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
          <strong>Supporting Documents</strong>
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
                    </div>
                  </div>

                  <div className="d-flex gap-1 flex-shrink-0 ms-2">
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
                    <CButton
                      size="sm"
                      color="danger"
                      variant="ghost"
                      title="Delete"
                      onClick={() => setConfirmDeleteId(doc.id)}
                    >
                      <CIcon icon={cilTrash} />
                    </CButton>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upload form */}
          <CForm onSubmit={handleUpload}>
            <CRow className="g-3">
              <CCol md={4}>
                <CFormLabel>Category</CFormLabel>
                <CFormSelect value={form.documentCategory} onChange={setField('documentCategory')}>
                  {CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={4}>
                <CFormLabel>Document type</CFormLabel>
                <CFormSelect value={form.documentType} onChange={setField('documentType')}>
                  {LOAN_DOCUMENT_TYPES.map((v) => (
                    <option key={v} value={v}>{DOCUMENT_TYPE.labels[v]}</option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={4}>
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
                  onChange={setField('description')}
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
    </>
  )
}

LoanDocuments.propTypes = {
  loanId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
}

export default LoanDocuments
