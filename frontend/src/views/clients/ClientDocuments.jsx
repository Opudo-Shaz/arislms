/**
 * ClientDocuments
 *
 * KYC documents card: lists uploaded documents and provides an upload form
 * (type, file, notes).
 *
 * NOTE: The backend does not yet expose a client-documents endpoint, so
 * uploads are held in local component state only and are lost on reload.
 * When the API is available, replace the local state + handlers with a
 * `clientDocumentApi` module + TanStack Query hooks (list/upload/delete),
 * mirroring the clients/loan-products pattern.
 *
 * @module views/clients/ClientDocuments
 */

import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
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
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCloudUpload, cilFile, cilTrash } from '@coreui/icons'

/** Supported KYC document types. */
export const DOCUMENT_TYPES = [
  { value: 'client_photo', label: 'Client Photo' },
  { value: 'national_id', label: 'National ID' },
  { value: 'passport', label: 'Passport' },
  { value: 'driving_license', label: 'Driving License' },
  { value: 'business_permit', label: 'Business Permit' },
  { value: 'other', label: 'Other' },
]

const labelForType = (value) =>
  DOCUMENT_TYPES.find((t) => t.value === value)?.label || value

const formatSize = (bytes) => {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const emptyForm = { type: 'national_id', notes: '', file: null, fileName: '' }

const ClientDocuments = () => {
  // TODO: replace with API-backed list once backend supports client documents.
  const [documents, setDocuments] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)

  const handleFile = (e) => {
    const file = e.target.files?.[0] || null
    setForm((f) => ({ ...f, file, fileName: file?.name || '' }))
  }

  const handleUpload = (e) => {
    e.preventDefault()
    if (!form.file) {
      setError('Please choose a file to upload.')
      return
    }
    setError(null)
    setDocuments((docs) => [
      ...docs,
      {
        id: `${Date.now()}-${form.fileName}`,
        type: form.type,
        fileName: form.fileName,
        size: form.file.size,
        notes: form.notes.trim(),
        url: URL.createObjectURL(form.file),
        uploadedAt: new Date().toISOString(),
      },
    ])
    setForm(emptyForm)
    // Reset the native file input value.
    e.target.reset()
  }

  const removeDocument = (docId) =>
    setDocuments((docs) => {
      const target = docs.find((d) => d.id === docId)
      if (target?.url) URL.revokeObjectURL(target.url)
      return docs.filter((d) => d.id !== docId)
    })

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>KYC Documents</strong>
        <small className="text-body-secondary">Stored locally until backend support is added</small>
      </CCardHeader>
      <CCardBody>
        {documents.length === 0 ? (
          <p className="text-body-secondary">No documents uploaded yet.</p>
        ) : (
          <div className="vstack gap-2 mb-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="d-flex align-items-start justify-content-between border rounded p-2"
              >
                <div className="d-flex gap-2">
                  <CIcon icon={cilFile} size="lg" className="text-body-secondary mt-1" />
                  <div>
                    <div className="fw-semibold">{labelForType(doc.type)}</div>
                    <a href={doc.url} target="_blank" rel="noreferrer" className="small">
                      {doc.fileName}
                    </a>{' '}
                    <span className="small text-body-secondary">{formatSize(doc.size)}</span>
                    {doc.notes && <div className="small text-body-secondary">{doc.notes}</div>}
                  </div>
                </div>
                <CButton
                  size="sm"
                  color="danger"
                  variant="ghost"
                  onClick={() => removeDocument(doc.id)}
                >
                  <CIcon icon={cilTrash} />
                </CButton>
              </div>
            ))}
          </div>
        )}

        <CForm onSubmit={handleUpload}>
          <CRow className="g-3">
            <CCol md={4}>
              <CFormLabel>Document type</CFormLabel>
              <CFormSelect
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={8}>
              <CFormLabel>File</CFormLabel>
              <CFormInput type="file" onChange={handleFile} />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Notes</CFormLabel>
              <CFormTextarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </CCol>
          </CRow>
          {error && <div className="text-danger small mt-2">{error}</div>}
          <CButton type="submit" color="primary" className="mt-3">
            <CIcon icon={cilCloudUpload} className="me-1" />
            Upload Document
          </CButton>
        </CForm>
      </CCardBody>
    </CCard>
  )
}

ClientDocuments.propTypes = {
  clientId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
}

export default ClientDocuments
