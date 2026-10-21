/**
 * RegistrationLinksList
 *
 * Staff view of invite-only client registration links: generate a link
 * (optionally sending it to emails/phone numbers), copy it again later, see
 * how many clients registered through it, and revoke it.
 *
 * @module views/clients/RegistrationLinksList
 */

import React, { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CAlert, CButton, CCard, CCardBody, CCardHeader, CCol, CRow } from '@coreui/react'
import FormSelect from '../../components/FormSelect'
import CIcon from '@coreui/icons-react'
import { cilBan, cilCopy, cilPlus, cilReload } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import ConfirmModal from '../../components/ConfirmModal'
import StatusBadge from '../../components/StatusBadge'
import RegistrationLinkCreateModal from './RegistrationLinkCreateModal'
import RegistrationLinkDetailModal from './RegistrationLinkDetailModal'
import { useRegistrationLinks, useRevokeRegistrationLink } from '../../hooks/useClientRegistrationLinks'
import clientRegistrationLinkApi from '../../api/clientRegistrationLinkApi'
import { useAuth } from '../../context/AuthContext'
import { CLIENT_REGISTRATION_LINK_STATUS } from '../../constants/enums'
import { formatDate } from '../../utils/format'

const RegistrationLinksList = () => {
  const { hasPermission } = useAuth()
  const canRead = hasPermission('client_registration_links:read')
  const canCreate = hasPermission('client_registration_links:create')
  const canManage = hasPermission('client_registration_links:update')

  const [statusFilter, setStatusFilter] = useState('')
  const { data: links = [], isLoading, error, refetch, isFetching } = useRegistrationLinks(
    statusFilter ? { status: statusFilter } : undefined,
  )
  const revokeMutation = useRevokeRegistrationLink()

  const [creating, setCreating] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [toRevoke, setToRevoke] = useState(null)
  const [notice, setNotice] = useState(null)
  const [actionError, setActionError] = useState(null)

  const copyLink = async (row) => {
    setActionError(null)
    try {
      await navigator.clipboard.writeText(await clientRegistrationLinkApi.getLinkUrl(row.id))
      setNotice(`Link for "${row.label || `#${row.id}`}" copied to the clipboard.`)
    } catch (err) {
      setActionError(err)
    }
  }

  const columns = useMemo(
    () => [
      {
        key: 'label',
        label: 'Label',
        render: (row) => <span className="fw-semibold">{row.label || `Link #${row.id}`}</span>,
      },
      {
        key: 'status',
        label: 'Status',
        render: (row) => <StatusBadge enumDef={CLIENT_REGISTRATION_LINK_STATUS} value={row.status} />,
      },
      { key: 'usedCount', label: 'Clients registered', render: (row) => row.usedCount },
      { key: 'expiresAt', label: 'Expires', render: (row) => formatDate(row.expiresAt) },
      { key: 'createdByName', label: 'Created by', render: (row) => row.createdByName || '—' },
      { key: 'createdAt', label: 'Created', render: (row) => formatDate(row.createdAt) },
      canManage && {
        key: 'actions',
        label: '',
        className: 'text-end',
        render: (row) => (
          <div className="d-flex gap-2 justify-content-end">
            {row.status !== 'revoked' && (
              <CButton
                color="light"
                size="sm"
                title="Copy link"
                onClick={(e) => {
                  e.stopPropagation()
                  copyLink(row)
                }}
              >
                <CIcon icon={cilCopy} />
              </CButton>
            )}
            {row.status === 'active' && (
              <CButton
                color="danger"
                size="sm"
                variant="outline"
                title="Revoke"
                onClick={(e) => {
                  e.stopPropagation()
                  setToRevoke(row)
                }}
              >
                <CIcon icon={cilBan} />
              </CButton>
            )}
          </div>
        ),
      },
    ].filter(Boolean),
    [canManage],
  )

  const runRevoke = async () => {
    try {
      await revokeMutation.mutateAsync(toRevoke.id)
      setToRevoke(null)
    } catch (err) {
      setActionError(err)
      setToRevoke(null)
    }
  }

  if (!canRead) return <Navigate to="/unauthorized" replace />

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Client Registration Links</strong>
        <div className="d-flex gap-2">
          <CButton color="light" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <CIcon icon={cilReload} className="me-1" />
            Refresh
          </CButton>
          {canCreate && (
            <CButton color="primary" size="sm" onClick={() => setCreating(true)}>
              <CIcon icon={cilPlus} className="me-1" />
              New link
            </CButton>
          )}
        </div>
      </CCardHeader>
      <CCardBody>
        {actionError && (
          <CAlert color="danger" dismissible onClose={() => setActionError(null)}>
            {actionError.message || 'Action failed.'}
          </CAlert>
        )}
        {notice && (
          <CAlert color="success" dismissible onClose={() => setNotice(null)}>
            {notice}
          </CAlert>
        )}

        <CRow className="g-2 mb-3">
          <CCol md={4}>
            <FormSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="revoked">Revoked</option>
            </FormSelect>
          </CCol>
        </CRow>

        <DataTable
          columns={columns}
          rows={links}
          rowKey={(row) => row.id}
          loading={isLoading}
          error={error}
          emptyMessage="No registration links yet."
          onRowClick={(row) => setDetailId(row.id)}
        />
      </CCardBody>

      <RegistrationLinkCreateModal visible={creating} onClose={() => setCreating(false)} />
      <RegistrationLinkDetailModal linkId={detailId} onClose={() => setDetailId(null)} />

      <ConfirmModal
        visible={Boolean(toRevoke)}
        title="Revoke registration link"
        body={
          toRevoke
            ? `Revoke "${toRevoke.label || `Link #${toRevoke.id}`}"? No one will be able to register with it afterwards. Clients who already registered are not affected.`
            : ''
        }
        confirmText="Revoke"
        confirmColor="danger"
        loading={revokeMutation.isPending}
        onConfirm={runRevoke}
        onClose={() => setToRevoke(null)}
      />
    </CCard>
  )
}

export default RegistrationLinksList
