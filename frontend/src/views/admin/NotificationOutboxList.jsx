/**
 * NotificationOutboxList
 *
 * Admin view for the notification delivery queue. Shows every dispatched
 * notification attempt (one row per recipient x channel) with its status,
 * attempt count, and last error, and lets admins manually retry FAILED or
 * SKIPPED entries. Backend uses page/limit pagination.
 *
 * @module views/admin/NotificationOutboxList
 */

import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormSelect,
  CPagination,
  CPaginationItem,
  CRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilReload, cilSync } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ConfirmModal from '../../components/ConfirmModal'
import { useNotificationOutbox, useRetryOutboxEntry } from '../../hooks/useNotificationOutbox'
import { NOTIFICATION_CHANNEL, NOTIFICATION_DELIVERY_STATUS } from '../../constants/enums'
import { useAuth } from '../../context/AuthContext'
import { formatDateTime } from '../../utils/format'

const PAGE_SIZE = 20
const RETRYABLE_STATUSES = ['failed', 'skipped']

const NotificationOutboxList = () => {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('notifications:manage_outbox')

  const [status, setStatus] = useState('')
  const [channel, setChannel] = useState('')
  const [eventKey, setEventKey] = useState('')
  const [page, setPage] = useState(1)
  const [toRetry, setToRetry] = useState(null)
  const [retryError, setRetryError] = useState('')

  const params = { status, channel, eventKey, page, limit: PAGE_SIZE }
  const { data, isLoading, error, refetch, isFetching } = useNotificationOutbox(params)
  const retryMutation = useRetryOutboxEntry()

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const resetPageAnd = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  const confirmRetry = async () => {
    setRetryError('')
    try {
      await retryMutation.mutateAsync(toRetry.id)
      setToRetry(null)
    } catch (err) {
      setRetryError(err?.data?.message || err?.message || 'Failed to retry entry')
    }
  }

  const columns = [
    { key: 'createdAt', label: 'Created', render: (r) => formatDateTime(r.createdAt || r.created_at) },
    { key: 'eventKey', label: 'Event', render: (r) => <code>{r.eventKey}</code> },
    {
      key: 'channel',
      label: 'Channel',
      render: (r) => <StatusBadge enumDef={NOTIFICATION_CHANNEL} value={r.channel} />,
    },
    { key: 'toAddress', label: 'To', render: (r) => r.toAddress || '—' },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge enumDef={NOTIFICATION_DELIVERY_STATUS} value={r.status} />,
    },
    {
      key: 'attempts',
      label: 'Attempts',
      render: (r) => `${r.attempts ?? 0} / ${r.maxAttempts ?? '—'}`,
    },
    {
      key: 'lastError',
      label: 'Last Error',
      render: (r) =>
        r.lastError ? (
          <span className="text-danger text-truncate d-inline-block" style={{ maxWidth: 240 }} title={r.lastError}>
            {r.lastError}
          </span>
        ) : (
          <span className="text-body-secondary">—</span>
        ),
    },
    {
      key: 'nextAttemptAt',
      label: 'Next Attempt',
      render: (r) => (r.nextAttemptAt ? formatDateTime(r.nextAttemptAt) : '—'),
    },
    {
      key: 'actions',
      label: '',
      className: 'text-end',
      render: (r) => (
        <div className="d-flex justify-content-end">
          {canManage && RETRYABLE_STATUSES.includes(r.status) && (
            <CButton
              color="primary"
              size="sm"
              className="d-inline-flex align-items-center text-nowrap"
              title="Retry"
              onClick={() => {
                setRetryError('')
                setToRetry(r)
              }}
            >
              <CIcon icon={cilSync} className="me-1" />
              Retry
            </CButton>
          )}
        </div>
      ),
    },
  ]

  if (!canManage) return <Navigate to="/unauthorized" replace />

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Notification Outbox</strong>
        <CButton color="light" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <CIcon icon={cilReload} className="me-1" />
          Refresh
        </CButton>
      </CCardHeader>
      <CCardBody>
        <CRow className="g-2 mb-3">
          <CCol md={3}>
            <CFormSelect value={status} onChange={(e) => resetPageAnd(setStatus)(e.target.value)}>
              <option value="">All statuses</option>
              {NOTIFICATION_DELIVERY_STATUS.values.map((v) => (
                <option key={v} value={v}>
                  {NOTIFICATION_DELIVERY_STATUS.labels[v]}
                </option>
              ))}
            </CFormSelect>
          </CCol>
          <CCol md={3}>
            <CFormSelect value={channel} onChange={(e) => resetPageAnd(setChannel)(e.target.value)}>
              <option value="">All channels</option>
              {NOTIFICATION_CHANNEL.values.map((v) => (
                <option key={v} value={v}>
                  {NOTIFICATION_CHANNEL.labels[v]}
                </option>
              ))}
            </CFormSelect>
          </CCol>
          <CCol md={4}>
            <CFormInput
              placeholder="Filter by event key…"
              value={eventKey}
              onChange={(e) => resetPageAnd(setEventKey)(e.target.value)}
            />
          </CCol>
        </CRow>

        <DataTable
          columns={columns}
          rows={rows}
          loading={isLoading}
          error={error}
          emptyMessage="No outbox entries match your filters."
        />

        {totalPages > 1 && (
          <CPagination align="end" className="mt-3">
            <CPaginationItem disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </CPaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…')
                acc.push(p)
                return acc
              }, [])
              .map((p, idx) =>
                p === '…' ? (
                  <CPaginationItem key={`ellipsis-${idx}`} disabled>
                    …
                  </CPaginationItem>
                ) : (
                  <CPaginationItem key={p} active={p === page} onClick={() => setPage(p)}>
                    {p}
                  </CPaginationItem>
                ),
              )}
            <CPaginationItem
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </CPaginationItem>
          </CPagination>
        )}
      </CCardBody>

      <ConfirmModal
        visible={Boolean(toRetry)}
        title="Retry Notification"
        body={
          toRetry
            ? `Re-queue this ${toRetry.channel} notification for event "${toRetry.eventKey}" for immediate delivery?`
            : ''
        }
        confirmText="Retry"
        confirmColor="primary"
        loading={retryMutation.isPending}
        onConfirm={confirmRetry}
        onClose={() => setToRetry(null)}
      />
      {retryError && (
        <div className="text-danger small px-3 pb-3">{retryError}</div>
      )}
    </CCard>
  )
}

export default NotificationOutboxList
