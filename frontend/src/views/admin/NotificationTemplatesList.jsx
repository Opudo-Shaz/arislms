/**
 * NotificationTemplatesList
 *
 * Admin-only view for managing notification templates — one entry per event
 * key, with per-channel (email/SMS/WhatsApp/push/in-app) enabled flags and content.
 * Templates are looked up by `eventKey` at dispatch time; missing/inactive
 * templates simply mean no notification is sent for that event.
 *
 * @module views/admin/NotificationTemplatesList
 */

import React, { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { Navigate } from 'react-router-dom'
import { CAlert, CButton, CCard, CCardBody, CCardHeader, CFormInput } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPencil, cilPlus, cilReload, cilTrash } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ConfirmModal from '../../components/ConfirmModal'
import NotificationTemplateForm from './NotificationTemplateForm'
import {
  useNotificationTemplates,
  useDeleteNotificationTemplate,
  useUpdateNotificationTemplate,
} from '../../hooks/useNotificationTemplates'
import { useAuth } from '../../context/AuthContext'

const ACTIVE_ENUM = { colors: { true: 'success', false: 'secondary' }, labels: { true: 'Active', false: 'Inactive' } }

// Colours match the channel sections in NotificationTemplateForm.
const CHANNEL_BADGES = [
  { key: 'emailEnabled', label: 'Email', color: 'var(--tpl-ch-email)', defaultOn: true },
  { key: 'smsEnabled', label: 'SMS', color: 'var(--tpl-ch-sms)', defaultOn: true },
  { key: 'whatsappEnabled', label: 'WhatsApp', color: 'var(--tpl-ch-whatsapp)', defaultOn: false },
  { key: 'pushEnabled', label: 'Push', color: 'var(--tpl-ch-push)', defaultOn: true },
  { key: 'inAppEnabled', label: 'In-App', color: 'var(--tpl-ch-inapp)', defaultOn: true },
]

const isChannelOn = (row, { key, defaultOn }) => (defaultOn ? row[key] !== false : row[key] === true)

const TEMPLATE_FIELDS = [
  'description', 'emailSubject', 'emailBody', 'smsBody', 'whatsappBody', 'pushTitle', 'pushBody',
  'inAppTitle', 'inAppBody', 'emailEnabled', 'smsEnabled', 'whatsappEnabled', 'pushEnabled',
  'inAppEnabled', 'isActive',
]

/** Soft pill that toggles one channel; looks like the audit-trail action badges. */
const ChannelPill = ({ label, color, on, pending, onToggle }) => (
  <button
    type="button"
    disabled={pending}
    onClick={(e) => {
      e.stopPropagation()
      onToggle()
    }}
    title={`${label}: ${on ? 'enabled' : 'disabled'} — click to ${on ? 'disable' : 'enable'}`}
    className="badge rounded-pill fw-medium px-2 py-1 d-inline-flex align-items-center gap-1"
    style={{
      cursor: pending ? 'wait' : 'pointer',
      opacity: pending ? 0.6 : 1,
      color: on ? color : 'var(--cui-secondary-color)',
      backgroundColor: on ? `color-mix(in srgb, ${color} 12%, transparent)` : 'var(--cui-tertiary-bg)',
      border: `1px solid ${on ? `color-mix(in srgb, ${color} 33%, transparent)` : 'var(--cui-border-color)'}`,
      textDecoration: on ? 'none' : 'line-through',
    }}
  >
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: on ? color : 'var(--cui-secondary-color)',
      }}
    />
    {label}
  </button>
)

ChannelPill.propTypes = {
  label: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
  on: PropTypes.bool.isRequired,
  pending: PropTypes.bool,
  onToggle: PropTypes.func.isRequired,
}

const NotificationTemplatesList = () => {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('notifications:manage_templates')

  const { data: templates = [], isLoading, error, refetch, isFetching } = useNotificationTemplates()
  const deleteMutation = useDeleteNotificationTemplate()
  const updateMutation = useUpdateNotificationTemplate()
  const [toggleError, setToggleError] = useState(null)

  // Send the full set of fields: the update schema applies defaults to omitted ones.
  const toggleChannel = async (row, key, next) => {
    setToggleError(null)
    const payload = Object.fromEntries(TEMPLATE_FIELDS.map((f) => [f, row[f] ?? null]))
    payload.emailEnabled = row.emailEnabled !== false
    payload.smsEnabled = row.smsEnabled !== false
    payload.whatsappEnabled = row.whatsappEnabled === true
    payload.pushEnabled = row.pushEnabled !== false
    payload.inAppEnabled = row.inAppEnabled !== false
    payload.isActive = row.isActive !== false
    payload[key] = next
    try {
      await updateMutation.mutateAsync({ id: row.id, payload })
    } catch (err) {
      setToggleError(err)
    }
  }

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
          {CHANNEL_BADGES.map((ch) => {
            const on = isChannelOn(row, ch)
            return (
              <ChannelPill
                key={ch.key}
                label={ch.label}
                color={ch.color}
                on={on}
                pending={updateMutation.isPending && updateMutation.variables?.id === row.id}
                onToggle={() => toggleChannel(row, ch.key, !on)}
              />
            )
          })}
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
      <div className="d-flex gap-2 justify-content-end" onClick={(e) => e.stopPropagation()}>
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

        {toggleError && (
          <CAlert color="danger" dismissible onClose={() => setToggleError(null)}>
            {toggleError.message || 'Failed to update channel.'}
          </CAlert>
        )}

        <DataTable
          columns={columns}
          rows={filtered}
          loading={isLoading}
          error={error}
          onRowClick={openEdit}
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
