/**
 * ClientDetail
 *
 * Client profile with KYC and status actions. Read-only profile fields plus
 * action buttons that open a confirmation dialog (with optional notes) and
 * call the corresponding mutation.
 *
 * @module views/clients/ClientDetail
 */

import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CAvatar,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPencil, cilTrash } from '@coreui/icons'

import StatusBadge from '../../components/StatusBadge'
import ConfirmModal from '../../components/ConfirmModal'
import ClientDocuments from './ClientDocuments'
import { useClient, useClientAction, useDeleteClient } from '../../hooks/useClients'
import { useDocumentBlobUrl } from '../../hooks/useDocuments'
import { CLIENT_STATUS, KYC_STATUS } from '../../constants/enums'
import { formatCurrency, formatDate } from '../../utils/format'

/** Action definitions keyed by id; drives the confirmation dialog. */
const ACTIONS = {
  verify: {
    label: 'Verify KYC',
    color: 'success',
    title: 'Verify KYC',
    body: 'Mark this client’s KYC as verified and activate the account?',
    notesRequired: false,
    notesLabel: 'Notes',
  },
  'request-info': {
    label: 'Request KYC Info',
    color: 'warning',
    title: 'Request Additional KYC Info',
    body: 'Set the client to pending re-verification and record what is needed.',
    notesRequired: true,
    notesLabel: 'What information is required?',
  },
  reject: {
    label: 'Reject KYC',
    color: 'danger',
    title: 'Reject KYC',
    body: 'Reject KYC and set the client status to KYC failed?',
    notesRequired: false,
    notesLabel: 'Reason',
  },
  activate: {
    label: 'Activate',
    color: 'success',
    title: 'Activate Client',
    body: 'Set this client to active?',
    notesRequired: false,
    notesLabel: 'Notes',
  },
  deactivate: {
    label: 'Deactivate',
    color: 'secondary',
    title: 'Deactivate Client',
    body: 'Deactivate this client?',
    notesRequired: false,
    notesLabel: 'Notes',
  },
  suspend: {
    label: 'Suspend',
    color: 'warning',
    title: 'Suspend Client',
    body: 'Suspend this client?',
    notesRequired: false,
    notesLabel: 'Notes',
  },
  blacklist: {
    label: 'Blacklist',
    color: 'danger',
    title: 'Blacklist Client',
    body: 'Blacklist this client? This is a serious action.',
    notesRequired: false,
    notesLabel: 'Reason',
  },
}

const Field = ({ label, children }) => (
  <CCol md={6} className="mb-3">
    <div className="text-body-secondary small">{label}</div>
    <div>{children ?? '—'}</div>
  </CCol>
)

const ClientDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: client, isLoading, error } = useClient(id)
  const action = useClientAction()
  const deleteMutation = useDeleteClient()

  // Derive the client photo from the documents array (loaded with the client record).
  const photoDoc = client?.documents?.find((d) => d.documentType === 'client_photo')
  const clientPhotoUrl = useDocumentBlobUrl(photoDoc?.id)

  const [activeAction, setActiveAction] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [actionError, setActionError] = useState(null)

  const runAction = async (notes) => {
    setActionError(null)
    try {
      await action.mutateAsync({ id, action: activeAction, notes })
      setActiveAction(null)
    } catch (err) {
      setActionError(err)
    }
  }

  const runDelete = async () => {
    setActionError(null)
    try {
      await deleteMutation.mutateAsync(id)
      navigate('/clients')
    } catch (err) {
      setActionError(err)
      setConfirmDelete(false)
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )
  }

  if (error || !client) {
    return <CAlert color="danger">{error?.message || 'Client not found.'}</CAlert>
  }

  const cfg = activeAction ? ACTIONS[activeAction] : null

  return (
    <>
      <CRow>
        <CCol lg={8}>
          <CCard className="mb-4">
            <CCardHeader className="d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-3">
                <CAvatar
                  color="secondary"
                  textColor="white"
                  size="md"
                  src={clientPhotoUrl || undefined}
                  style={{ width: 40, height: 40, minWidth: 40, objectFit: 'cover', borderRadius: '50%', overflow: 'hidden' }}
                >
                  {!clientPhotoUrl &&
                    `${client.firstName?.[0] || ''}${client.lastName?.[0] || ''}`.toUpperCase()}
                </CAvatar>
                <strong>
                  {client.firstName} {client.lastName}
                </strong>
              </div>
              <div className="d-flex gap-2">
                <CButton
                  color="light"
                  size="sm"
                  onClick={() => navigate(`/clients/${id}/edit`)}
                >
                  <CIcon icon={cilPencil} className="me-1" />
                  Edit
                </CButton>
                <CButton color="danger" size="sm" variant="outline" onClick={() => setConfirmDelete(true)}>
                  <CIcon icon={cilTrash} className="me-1" />
                  Delete
                </CButton>
              </div>
            </CCardHeader>
            <CCardBody>
              {actionError && (
                <CAlert color="danger">{actionError.message || 'Action failed.'}</CAlert>
              )}
              <CRow>
                <Field label="Status">
                  <StatusBadge enumDef={CLIENT_STATUS} value={client.status} />
                </Field>
                <Field label="KYC Status">
                  <StatusBadge enumDef={KYC_STATUS} value={client.kycStatus} />
                </Field>
                <Field label="Account Number">{client.accountNumber}</Field>
                <Field label="Email">{client.email}</Field>
                <Field label="Phone">{client.phone}</Field>
                <Field label="Secondary Phone">{client.secondaryPhone}</Field>
                <Field label="Date of Birth">{formatDate(client.dateOfBirth)}</Field>
                <Field label="Gender">{client.gender}</Field>
                <Field label="Occupation">{client.occupation}</Field>
                <Field label="Employer">{client.employer}</Field>
                <Field label="Monthly Income">{formatCurrency(client.monthlyIncome)}</Field>
                <Field label="Preferred Contact">{client.preferredContactMethod}</Field>
                <Field label="Address">
                  {client.address
                    ? [
                        client.address.street,
                        client.address.city,
                        client.address.state,
                        client.address.postalCode,
                        client.address.country,
                      ]
                        .filter(Boolean)
                        .join(', ')
                    : '—'}
                </Field>
                <Field label="KYC Verified At">{formatDate(client.kycVerifiedAt)}</Field>
              </CRow>
            </CCardBody>
          </CCard>

          <ClientDocuments clientId={id} />
        </CCol>

        <CCol lg={4}>
          <CCard className="mb-4">
            <CCardHeader>
              <strong>KYC</strong>
            </CCardHeader>
            <CCardBody className="d-grid gap-2">
              {['verify', 'request-info', 'reject'].map((key) => (
                <CButton
                  key={key}
                  color={ACTIONS[key].color}
                  variant="outline"
                  onClick={() => {
                    setActionError(null)
                    setActiveAction(key)
                  }}
                >
                  {ACTIONS[key].label}
                </CButton>
              ))}
            </CCardBody>
          </CCard>

          <CCard className="mb-4">
            <CCardHeader>
              <strong>Status</strong>
            </CCardHeader>
            <CCardBody className="d-grid gap-2">
              {['activate', 'deactivate', 'suspend', 'blacklist'].map((key) => (
                <CButton
                  key={key}
                  color={ACTIONS[key].color}
                  variant="outline"
                  onClick={() => {
                    setActionError(null)
                    setActiveAction(key)
                  }}
                >
                  {ACTIONS[key].label}
                </CButton>
              ))}
            </CCardBody>
          </CCard>

          {client.creditScore && (
            <CCard className="mb-4">
              <CCardHeader>
                <strong>Latest Credit Score</strong>
              </CCardHeader>
              <CCardBody>
                <div className="d-flex align-items-baseline gap-2">
                  <span className="fs-3 fw-semibold">
                    {client.creditScore.riskScore ?? '—'}
                  </span>
                  {client.creditScore.riskGrade && (
                    <CBadge color="info">Grade {client.creditScore.riskGrade}</CBadge>
                  )}
                </div>
                <dl className="row mb-0 mt-2 small">
                  <dt className="col-6 text-body-secondary fw-normal">Credit Limit</dt>
                  <dd className="col-6 mb-1">{formatCurrency(client.creditScore.creditLimit)}</dd>

                  <dt className="col-6 text-body-secondary fw-normal">Risk Score</dt>
                  <dd className="col-6 mb-1">{client.creditScore.riskScore ?? '—'}</dd>

                  <dt className="col-6 text-body-secondary fw-normal">Risk Grade</dt>
                  <dd className="col-6 mb-1">{client.creditScore.riskGrade || '—'}</dd>

                  <dt className="col-6 text-body-secondary fw-normal">Model Version</dt>
                  <dd className="col-6 mb-1">{client.creditScore.scoringModelVersion || '—'}</dd>

                  <dt className="col-6 text-body-secondary fw-normal">Created</dt>
                  <dd className="col-6 mb-1">
                    {formatDate(client.creditScore.createdAt ?? client.creditScore.created_at)}
                  </dd>

                  {client.creditScore.notes && (
                    <>
                      <dt className="col-12 text-body-secondary fw-normal">Notes</dt>
                      <dd className="col-12 mb-0">{client.creditScore.notes}</dd>
                    </>
                  )}
                </dl>
              </CCardBody>
            </CCard>
          )}
        </CCol>
      </CRow>

      <ConfirmModal
        visible={Boolean(activeAction)}
        title={cfg?.title || ''}
        body={cfg?.body}
        confirmText={cfg?.label}
        confirmColor={cfg?.color}
        loading={action.isPending}
        withNotes
        notesLabel={cfg?.notesLabel}
        notesRequired={cfg?.notesRequired}
        onConfirm={runAction}
        onClose={() => setActiveAction(null)}
      />

      <ConfirmModal
        visible={confirmDelete}
        title="Delete Client"
        body="Are you sure you want to delete this client? This cannot be undone."
        confirmText="Delete"
        confirmColor="danger"
        loading={deleteMutation.isPending}
        onConfirm={runDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  )
}

export default ClientDetail
