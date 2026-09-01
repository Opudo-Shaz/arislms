/**
 * NotificationTemplatesList
 *
 * Admin-only view for managing notification templates — one entry per event
 * key, with per-channel (email/SMS/push/in-app) enabled flags and content.
 * Templates are looked up by `eventKey` at dispatch time; missing/inactive
 * templates simply mean no notification is sent for that event.
 *
 * @module views/admin/NotificationTemplatesList
 */

import React, { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CBadge, CButton, CCard, CCardBody, CCardHeader, CFormInput } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPencil, cilPlus, cilReload, cilTrash } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ConfirmModal from '../../components/ConfirmModal'
import NotificationTemplateForm from './NotificationTemplateForm'
import { useNotificationTemplates, useDeleteNotificationTemplate } from '../../hooks/useNotificationTemplates'
import { useAuth } from '../../context/AuthContext'

const ACTIVE_ENUM = { colors: { true: 'success', false: 'secondary' }, labels: { true: 'Active', false: 'Inactive' } }

const CHANNEL_BADGES = [
  { key: 'emailEnabled', label: 'Email' },
  { key: 'smsEnabled', label: 'SMS' },
  { key: 'pushEnabled', label: 'Push' },
  { key: 'inAppEnabled', label: 'In-App' },
]

const NotificationTemplatesList = () => {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('notifications:manage_templates')

  const { data: templates = [], isLoading, error, refetch, isFetching } = useNotificationTemplates()
  const deleteMutation = useDeleteNotificationTemplate()

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return templates
    return templates.filter((t) =>
      [t.eventKey, t.description].filter(Boolean).join(' ').toLowerCase().includes(term),
    )
  }, [templates, search])

  const openCreate = () => {
    setEditing(null)
    setShowForm(true)
  }

  const openEdit = (t) => {
    setEditing(t)
    setShowForm(true)
  }

  const columns = [
    { key: 'eventKey', label: 'Event Key', render: (row) => <code>{row.eventKey}</code> },
    { key: 'description', label: 'Description', render: (row) => row.description || '—' },
    {
      key: 'channels',
      label: 'Channels',
      render: (row) => (
        <div className="d-flex flex-wrap gap-1">
          {CHANNEL_BADGES.map(({ key, label }) => (
            <CBadge key={key} color={row[key] !== false ? 'info' : 'secondary'}>
              {label}
            </CBadge>
          ))}
        </div>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => <StatusBadge enumDef={ACTIVE_ENUM} value={String(row.isActive !== false)} />,
    },
  ]

  columns.push({
    key: 'actions',
    label: '',
    className: 'text-end',
    render: (row) => (
      <div className="d-flex gap-2 justify-content-end">
        <CButton color="light" size="sm" title="Edit" onClick={() => openEdit(row)}>
          <CIcon icon={cilPencil} />
        </CButton>
        <CButton
          color="danger"
          size="sm"
          variant="outline"
          title="Delete"
          onClick={() => setToDelete(row)}
        >
          <CIcon icon={cilTrash} />
        </CButton>
      </div>
    ),
  })

  const runDelete = async () => {
    try {
      await deleteMutation.mutateAsync(toDelete.id)
      setToDelete(null)
    } catch {
      // Error surfaced via mutation state; modal stays open.
    }
  }

  if (!canManage) return <Navigate to="/unauthorized" replace />

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Notification Templates</strong>
        <div className="d-flex gap-2">
          <CButton color="light" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <CIcon icon={cilReload} className="me-1" />
            Refresh
          </CButton>
          <CButton color="primary" size="sm" onClick={openCreate}>
            <CIcon icon={cilPlus} className="me-1" />
            New Template
          </CButton>
        </div>
      </CCardHeader>
      <CCardBody>
        <div className="mb-3">
          <CFormInput
            placeholder="Search event key or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <DataTable
          columns={columns}
          rows={filtered}
          loading={isLoading}
          error={error}
          emptyMessage="No notification templates match your search."
        />
      </CCardBody>

      <NotificationTemplateForm visible={showForm} template={editing} onClose={() => setShowForm(false)} />

      <ConfirmModal
        visible={Boolean(toDelete)}
        title="Delete Notification Template"
        body={
          toDelete
            ? `Delete the template for event "${toDelete.eventKey}"? Notifications for this event will no longer be sent. This cannot be undone.`
            : ''
        }
        confirmText="Delete"
        confirmColor="danger"
        loading={deleteMutation.isPending}
        onConfirm={runDelete}
        onClose={() => setToDelete(null)}
      />
    </CCard>
  )
}

export default NotificationTemplatesList
