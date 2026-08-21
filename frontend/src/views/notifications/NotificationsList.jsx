/**
 * NotificationsList
 *
 * Full-page list of the current user's notifications with an unread filter and
 * per-item / bulk "mark as read" actions.
 *
 * @module views/notifications/NotificationsList
 */

import React, { useMemo, useState } from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CFormSwitch,
  CListGroup,
  CListGroupItem,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCheck, cilCheckAlt, cilReload, cilTrash } from '@coreui/icons'

import StatusBadge from '../../components/StatusBadge'
import ConfirmModal from '../../components/ConfirmModal'
import { useNotifications, useMarkNotificationRead, useDeleteNotification } from '../../hooks/useNotifications'
import { NOTIFICATION_TYPE } from '../../constants/enums'
import { formatDateTime } from '../../utils/format'

const NotificationsList = () => {
  const { data: notifications = [], isLoading, error, refetch, isFetching } = useNotifications()
  const markRead = useMarkNotificationRead()
  const deleteMutation = useDeleteNotification()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [toDelete, setToDelete] = useState(null)

  const visible = useMemo(
    () => (unreadOnly ? notifications.filter((n) => !n.isRead) : notifications),
    [notifications, unreadOnly],
  )

  const unread = useMemo(() => notifications.filter((n) => !n.isRead), [notifications])

  const markAll = async () => {
    await Promise.allSettled(unread.map((n) => markRead.mutateAsync(n.id)))
  }

  const runDelete = async () => {
    try {
      await deleteMutation.mutateAsync(toDelete.id)
      setToDelete(null)
    } catch {
      // Error surfaced via mutation state; modal stays open.
    }
  }

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>
          Notifications
          {unread.length > 0 && <span className="text-body-secondary"> ({unread.length} unread)</span>}
        </strong>
        <div className="d-flex gap-2 align-items-center">
          <CFormSwitch
            label="Unread only"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
          />
          <CButton color="light" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <CIcon icon={cilReload} className="me-1" />
            Refresh
          </CButton>
          <CButton
            color="primary"
            size="sm"
            onClick={markAll}
            disabled={unread.length === 0 || markRead.isPending}
          >
            <CIcon icon={cilCheckAlt} className="me-1" />
            Mark all read
          </CButton>
        </div>
      </CCardHeader>
      <CCardBody>
        {isLoading && (
          <div className="text-center py-5 text-body-secondary">
            <CSpinner size="sm" /> <span className="ms-2">Loading…</span>
          </div>
        )}
        {!isLoading && error && (
          <div className="text-center py-5 text-danger">
            {error.message || 'Failed to load notifications.'}
          </div>
        )}
        {!isLoading && !error && visible.length === 0 && (
          <div className="text-center py-5 text-body-secondary">No notifications to show.</div>
        )}

        {!isLoading && !error && visible.length > 0 && (
          <CListGroup flush>
            {visible.map((n) => (
              <CListGroupItem
                key={n.id}
                className={`d-flex justify-content-between align-items-start gap-3 ${
                  n.isRead ? '' : 'bg-body-tertiary'
                }`}
              >
                <div>
                  <div className="d-flex align-items-center gap-2">
                    <strong>{n.title}</strong>
                    <StatusBadge enumDef={NOTIFICATION_TYPE} value={n.type} />
                    {!n.isRead && (
                      <span className="badge bg-primary rounded-pill">New</span>
                    )}
                  </div>
                  <div className="text-body-secondary">{n.message}</div>
                  <small className="text-body-secondary">{formatDateTime(n.created_at)}</small>
                </div>
                <div className="d-flex gap-2">
                  {!n.isRead && (
                    <CButton
                      color="light"
                      size="sm"
                      title="Mark as read"
                      onClick={() => markRead.mutate(n.id)}
                      disabled={markRead.isPending}
                    >
                      <CIcon icon={cilCheck} />
                    </CButton>
                  )}
                  <CButton
                    color="danger"
                    variant="outline"
                    size="sm"
                    title="Delete"
                    onClick={() => setToDelete(n)}
                    disabled={deleteMutation.isPending}
                  >
                    <CIcon icon={cilTrash} />
                  </CButton>
                </div>
              </CListGroupItem>
            ))}
          </CListGroup>
        )}
      </CCardBody>

      <ConfirmModal
        visible={Boolean(toDelete)}
        title="Delete Notification"
        body={toDelete ? `Delete notification "${toDelete.title}"? This cannot be undone.` : ''}
        confirmText="Delete"
        confirmColor="danger"
        loading={deleteMutation.isPending}
        onConfirm={runDelete}
        onClose={() => setToDelete(null)}
      />
    </CCard>
  )
}

export default NotificationsList
