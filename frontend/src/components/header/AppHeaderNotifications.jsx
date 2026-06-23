/**
 * AppHeaderNotifications
 *
 * Header bell dropdown showing the current user's most recent notifications with
 * an unread-count badge. Polls periodically and links to the full notifications
 * page. Individual items can be marked as read inline.
 *
 * @module components/header/AppHeaderNotifications
 */

import React from 'react'
import { Link } from 'react-router-dom'
import {
  CBadge,
  CDropdown,
  CDropdownDivider,
  CDropdownHeader,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilBell } from '@coreui/icons'

import { useNotifications, useMarkNotificationRead } from '../../hooks/useNotifications'
import { formatDateTime } from '../../utils/format'

const MAX_ITEMS = 6

const AppHeaderNotifications = () => {
  // Poll every 60s so the badge stays roughly current without manual refresh.
  const { data: notifications = [] } = useNotifications({ refetchInterval: 60000 })
  const markRead = useMarkNotificationRead()

  const unreadCount = notifications.filter((n) => !n.isRead).length
  const recent = notifications.slice(0, MAX_ITEMS)

  return (
    <CDropdown variant="nav-item" placement="bottom-end">
      <CDropdownToggle caret={false}>
        <span className="position-relative">
          <CIcon icon={cilBell} size="lg" />
          {unreadCount > 0 && (
            <CBadge
              color="danger"
              shape="rounded-pill"
              className="position-absolute top-0 start-100 translate-middle"
              style={{ fontSize: '0.6rem' }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </CBadge>
          )}
        </span>
      </CDropdownToggle>
      <CDropdownMenu className="pt-0" style={{ minWidth: 320 }}>
        <CDropdownHeader className="bg-body-secondary fw-semibold">
          Notifications {unreadCount > 0 && `(${unreadCount} unread)`}
        </CDropdownHeader>

        {recent.length === 0 && (
          <CDropdownItem disabled className="text-body-secondary">
            No notifications.
          </CDropdownItem>
        )}

        {recent.map((n) => (
          <CDropdownItem
            key={n.id}
            className={`d-block ${n.isRead ? '' : 'fw-semibold'}`}
            onClick={(e) => {
              e.preventDefault()
              if (!n.isRead) markRead.mutate(n.id)
            }}
          >
            <div className="text-truncate">{n.title}</div>
            <small className="text-body-secondary">{formatDateTime(n.created_at)}</small>
          </CDropdownItem>
        ))}

        <CDropdownDivider />
        <CDropdownItem as={Link} to="/notifications" className="text-center">
          View all
        </CDropdownItem>
      </CDropdownMenu>
    </CDropdown>
  )
}

export default AppHeaderNotifications
