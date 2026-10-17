/**
 * Client portal: the client's KYC documents. Always viewable; uploads are
 * only offered while staff have asked for reverification, and only for the
 * files they flagged (or required ones never provided). Verified files can be
 * flagged by the client via "Request change" for staff to approve.
 *
 * @component
 */

import React, { useEffect, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCloudUpload, cilFile, cilMagnifyingGlass } from '@coreui/icons'

import StatusBadge from '../../components/StatusBadge'
import portalApi from '../../api/portalApi'
import { usePortalDocuments, useRequestDocumentChange, useUploadPortalDocument } from '../../hooks/usePortal'
import { DOCUMENT_TYPE, DOCUMENT_VERIFICATION_STATUS } from '../../constants/enums'
import { formatDate } from '../../utils/format'
import toast from '../../utils/toast'

const ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf'
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_FILE_BYTES = 5 * 1024 * 1024

const docLabel = (type) => DOCUMENT_TYPE.labels[type] || type
const errorMessage = (err, fallback) => err?.data?.errors?.[0]?.message || err?.message || fallback

const PreviewModal = ({ doc, onClose }) => {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!doc) return undefined
    let objectUrl
    let cancelled = false
    portalApi
      .getMyDocumentBlob(doc.id)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(doc.mimeType ? new Blob([blob], { type: doc.mimeType }) : blob)
        setUrl(objectUrl)
      })
      .catch((err) => !cancelled && setError(errorMessage(err, 'Could not load the document.')))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setUrl(null)
      setError(null)
    }
  }, [doc])

  const isImage = doc?.mimeType?.startsWith('image/')

  return (
    <CModal visible={Boolean(doc)} onClose={onClose} size="lg" alignment="center">
      <CModalHeader>
        <CModalTitle>{doc ? docLabel(doc.documentType) : ''}</CModalTitle>
      </CModalHeader>
      <CModalBody className="text-center">
        {error ? <CAlert color="danger" className="mb-0">{error}</CAlert> : null}
        {!error && !url ? <CSpinner color="primary" /> : null}
        {doc && url && isImage ? <img src={url} alt={doc.originalName} className="img-fluid rounded" /> : null}
        {doc && url && !isImage ? (
          <iframe src={url} title={doc.originalName} style={{ width: '100%', height: '70vh', border: 0 }} />
        ) : null}
      </CModalBody>
    </CModal>
  )
}

const UploadModal = ({ visible, types, initialType, onClose }) => {
  const upload = useUploadPortalDocument()
  const [documentType, setDocumentType] = useState(initialType || types[0] || '')
  const [file, setFile] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async () => {
    setError(null)
    if (!file) return setError('Choose a file to upload.')
    if (!ALLOWED_FILE_TYPES.includes(file.type)) return setError('Only JPG, PNG, WebP or PDF files are accepted.')
    if (file.size > MAX_FILE_BYTES) return setError('The file must be smaller than 5 MB.')
    try {
      const res = await upload.mutateAsync({ documentType, file })
      toast.success(res?.message || 'Document submitted for review')
      onClose()
    } catch (err) {
      setError(errorMessage(err, 'Could not upload the document.'))
    }
  }

  return (
    <CModal visible={visible} onClose={onClose} alignment="center">
      <CModalHeader>
        <CModalTitle>Upload document</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color="danger">{error}</CAlert> : null}
        <div className="mb-3">
          <CFormLabel htmlFor="kyc-type">Document</CFormLabel>
          <CFormSelect id="kyc-type" value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
            {types.map((t) => (
              <option key={t} value={t}>{docLabel(t)}</option>
            ))}
          </CFormSelect>
        </div>
        <div>
          <CFormLabel htmlFor="kyc-file">File</CFormLabel>
          <CFormInput id="kyc-file" type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <div className="form-text">JPG, PNG, WebP or PDF, up to 5 MB.</div>
        </div>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="ghost" onClick={onClose}>Cancel</CButton>
        <CButton color="primary" onClick={handleSubmit} disabled={upload.isPending}>
          {upload.isPending ? <CSpinner size="sm" /> : 'Upload'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

const ChangeRequestModal = ({ doc, onClose }) => {
  const requestChange = useRequestDocumentChange()
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)

  const handleSubmit = async () => {
    setError(null)
    try {
      const res = await requestChange.mutateAsync({ id: doc.id, reason: reason.trim() })
      toast.success(res?.message || 'Request sent')
      onClose()
    } catch (err) {
      setError(errorMessage(err, 'Could not send your request.'))
    }
  }

  return (
    <CModal visible={Boolean(doc)} onClose={onClose} alignment="center">
      <CModalHeader>
        <CModalTitle>Request a change</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color="danger">{error}</CAlert> : null}
        <p className="mb-2">
          Tell us why your {doc ? docLabel(doc.documentType).toLowerCase() : 'document'} needs to change (for example, it
          has expired). Our team will review your request and let you upload a new one.
        </p>
        <CFormTextarea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="ghost" onClick={onClose}>Cancel</CButton>
        <CButton color="primary" onClick={handleSubmit} disabled={reason.trim().length < 3 || requestChange.isPending}>
          {requestChange.isPending ? <CSpinner size="sm" /> : 'Send request'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

const MyKycDocuments = ({ me }) => {
  const { data, isLoading, error } = usePortalDocuments()
  const [preview, setPreview] = useState(null)
  const [uploadType, setUploadType] = useState(null)
  const [changeDoc, setChangeDoc] = useState(null)

  const documents = data?.documents || []
  const uploadable = data?.uploadableTypes || []
  const missing = uploadable.filter((t) => !documents.some((d) => d.documentType === t))

  return (
    <CCard>
      <CCardHeader className="d-flex align-items-center">
        <strong>Identity documents</strong>
        {uploadable.length ? (
          <CButton size="sm" color="primary" className="ms-auto" onClick={() => setUploadType(uploadable[0])}>
            <CIcon icon={cilCloudUpload} className="me-1" />
            Upload
          </CButton>
        ) : null}
      </CCardHeader>
      <CCardBody>
        {me?.status === 'pending_kyc_reverification' ? (
          <CAlert color="warning">
            <strong>We need to re-verify your identity.</strong>
            {me.kycNotes ? <div className="mt-1">{me.kycNotes}</div> : null}
            <div className="mt-1 small">
              {uploadable.length
                ? 'Please upload the documents marked below.'
                : 'Your documents have been submitted and are being reviewed.'}
            </div>
          </CAlert>
        ) : null}

        {isLoading ? <div className="text-center py-3"><CSpinner color="primary" /></div> : null}
        {error ? <CAlert color="danger">{error.message || 'Could not load your documents.'}</CAlert> : null}

        {!isLoading && !error && documents.length === 0 && missing.length === 0 ? (
          <p className="text-body-secondary mb-0">No documents on file.</p>
        ) : null}

        <div className="vstack gap-2">
          {documents.map((doc) => {
            const canReupload = uploadable.includes(doc.documentType)
            return (
              <div key={doc.id} className="d-flex flex-wrap align-items-center gap-2 border rounded p-2">
                <CIcon icon={cilFile} size="xl" className="text-body-secondary flex-shrink-0" />
                <div className="flex-grow-1 overflow-hidden">
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <strong>{docLabel(doc.documentType)}</strong>
                    <StatusBadge enumDef={DOCUMENT_VERIFICATION_STATUS} value={doc.verificationStatus} />
                  </div>
                  <div className="small text-body-secondary text-truncate" title={doc.originalName}>
                    {doc.originalName}
                    {doc.updatedAt ? ` · ${formatDate(doc.updatedAt)}` : ''}
                    {doc.expiresAt ? ` · expires ${formatDate(doc.expiresAt)}` : ''}
                  </div>
                  {doc.verificationNotes && doc.verificationStatus !== 'verified' ? (
                    <div className="small fst-italic text-danger-emphasis mt-1">** {doc.verificationNotes} **</div>
                  ) : null}
                </div>
                <div className="d-flex gap-1">
                  <CButton size="sm" color="secondary" variant="outline" onClick={() => setPreview(doc)}>
                    <CIcon icon={cilMagnifyingGlass} className="me-1" />
                    View
                  </CButton>
                  {canReupload ? (
                    <CButton size="sm" color="primary" onClick={() => setUploadType(doc.documentType)}>
                      <CIcon icon={cilCloudUpload} className="me-1" />
                      Replace
                    </CButton>
                  ) : null}
                  {doc.verificationStatus === 'verified' ? (
                    <CButton size="sm" color="info" className="text-white" onClick={() => setChangeDoc(doc)}>
                      Request change
                    </CButton>
                  ) : null}
                </div>
              </div>
            )
          })}

          {missing.map((type) => (
            <div key={type} className="d-flex align-items-center gap-2 border border-warning rounded p-2">
              <CIcon icon={cilFile} size="xl" className="text-warning flex-shrink-0" />
              <div className="flex-grow-1">
                <strong>{docLabel(type)}</strong>
                <div className="small text-body-secondary">Not yet provided</div>
              </div>
              <CButton size="sm" color="primary" onClick={() => setUploadType(type)}>
                <CIcon icon={cilCloudUpload} className="me-1" />
                Upload
              </CButton>
            </div>
          ))}
        </div>
      </CCardBody>

      <PreviewModal doc={preview} onClose={() => setPreview(null)} />
      {uploadType ? (
        <UploadModal
          key={uploadType}
          visible
          types={uploadable}
          initialType={uploadType}
          onClose={() => setUploadType(null)}
        />
      ) : null}
      {changeDoc ? <ChangeRequestModal key={changeDoc.id} doc={changeDoc} onClose={() => setChangeDoc(null)} /> : null}
    </CCard>
  )
}

export default MyKycDocuments
