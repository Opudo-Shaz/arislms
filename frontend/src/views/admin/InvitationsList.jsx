/**
 * InvitationsList
 *
 * Admin/manager view of invite-only registration links: shows status
 * (pending/accepted/expired/revoked) and allows resending (regenerates the
 * link) or revoking a still-pending invite.
 *
 * @module views/admin/InvitationsList
 */

import React, { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CAlert, CButton, CCard, CCardBody, CCardHeader, CCol, CFormSelect, CRow } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilBan, cilReload, cilSend } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import ConfirmModal from '../../components/ConfirmModal'
import StatusBadge from '../../components/StatusBadge'
import { useInvitations, useResendInvitation, useRevokeInvitation } from '../../hooks/useInvitations'
import { useAuth } from '../../context/AuthContext'
import { INVITATION_STATUS } from '../../constants/enums'
import { formatDate } from '../../utils/format'

const fullName = (i) => [i.first_name, i.middle_name, i.last_name].filter(Boolean).join(' ').trim() || '—'

const InvitationsList = () => {
  const { hasPermission } = useAuth()
  const canRead = hasPermission('invitations:read')
  const canManage = hasPermission('invitations:update')

  const [statusFilter, setStatusFilter] = useState('')
  const { data: invitations = [], isLoading, error, refetch, isFetching } = useInvitations(
    statusFilter ? { status: statusFilter } : undefined,
  )
  const resendMutation = useResendInvitation()
  const revokeMutation = useRevokeInvitation()

  const [toRevoke, setToRevoke] = useState(null)
  const [resent, setResent] = useState(null)
  const [actionError, setActionError] = useState(null)

  const columns = useMemo(
    () => [
      { key: 'name', label: 'Name', render: (row) => <span className="fw-semibold">{fullName(row)}</span> },
      { key: 'email', label: 'Email' },
      { key: 'role_name', label: 'Role', render: (row) => row.role_name || `Role ${row.role}` },
      {
        key: 'status',
        label: 'Status',
        render: (row) => <StatusBadge enumDef={INVITATION_STATUS} value={row.status} />,
      },
      { key: 'expires_at', label: 'Expires', render: (row) => formatDate(row.expires_at) },
      { key: 'created_at', label: 'Sent', render: (row) => formatDate(row.created_at) },
      canManage && {
        key: 'actions',
        label: '',
        className: 'text-end',
        render: (row) =>
          row.status === 'pending' ? (
            <div className="d-flex gap-2 justify-content-end">
              <CButton
                color="light"
                size="sm"
                title="Resend"
                disabled={resendMutation.isPending}
                onClick={async (e) => {
                  e.stopPropagation()
                  setActionError(null)
                  try {
                    const res = await resendMutation.mutateAsync(row.id)
                    setResent(res)
                  } catch (err) {
                    setActionError(err)
                  }
                }}
              >
                <CIcon icon={cilSend} />
              </CButton>
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
            </div>
          ) : null,
      },
    ].filter(Boolean),
    [canManage, resendMutation],
  )

  const runRevoke = async () => {
    try {
      await revokeMutation.mutateAsync(toRevoke.id)
      setToRevoke(null)
    } catch {
      // Error surfaced via mutation state; modal stays open.
    }
  }

  if (!canRead) return <Navigate to="/unauthorized" replace />

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Invitations</strong>
        <CButton color="light" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <CIcon icon={cilReload} className="me-1" />
          Refresh
        </CButton>
      </CCardHeader>
      <CCardBody>
        {actionError && (
          <CAlert color="danger" dismissible onClose={() => setActionError(null)}>
            {actionError.message || 'Action failed.'}
          </CAlert>
        )}
        {resent && (
          <CAlert color="success" dismissible onClose={() => setResent(null)}>
            <div>Invitation resent.</div>
            {resent.warnings?.map((w, i) => (
              <div key={i} className="text-warning-emphasis mt-1">
                {w}
              </div>
            ))}
            {resent.inviteUrl && <div className="small text-break mt-1">{resent.inviteUrl}</div>}
          </CAlert>
        )}

        <CRow className="g-2 mb-3">
          <CCol md={4}>
            <CFormSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="expired">Expired</option>
              <option value="revoked">Revoked</option>
            </CFormSelect>
          </CCol>
        </CRow>

        <DataTable
          columns={columns}
          rows={invitations}
          loading={isLoading}
          error={error}
          emptyMessage="No invitations found."
        />
      </CCardBody>

      <ConfirmModal
        visible={Boolean(toRevoke)}
        title="Revoke Invitation"
        body={toRevoke ? `Revoke the invitation sent to ${toRevoke.email}?` : ''}
        confirmText="Revoke"
        confirmColor="danger"
        loading={revokeMutation.isPending}
        onConfirm={runRevoke}
        onClose={() => setToRevoke(null)}
      />
    </CCard>
  )
}

export default InvitationsList
