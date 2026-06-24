import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAvatar,
  CDropdown,
  CDropdownDivider,
  CDropdownHeader,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
} from '@coreui/react'
import { cilAccountLogout, cilSettings, cilUser } from '@coreui/icons'
import CIcon from '@coreui/icons-react'

import { useAuth } from '../../context/AuthContext'
import { useUserDocuments, useDocumentBlobUrl } from '../../hooks/useDocuments'
import { USER_PHOTO_DOCUMENT_TYPE } from '../../constants/enums'
import avatar8 from './../../assets/images/avatars/8.jpg'

/** Tiny helper: resolves the user's latest profile photo blob URL. */
const useProfilePhotoUrl = (userId) => {
  const { data: docs = [] } = useUserDocuments(userId)
  const photoDoc = docs
    .filter((d) => (d.documentType ?? d.document_type) === USER_PHOTO_DOCUMENT_TYPE)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
  return useDocumentBlobUrl(photoDoc?.id)
}

const AppHeaderDropdown = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const photoUrl = useProfilePhotoUrl(user?.id)

  const handleLogout = () => {
    logout()
    // Clear any session storage or stale redirect state before navigating
    sessionStorage.clear()
    // Navigate to login without preserving any navigation state
    navigate('/login', { replace: true, state: undefined })
  }

  return (
    <CDropdown variant="nav-item">
      <CDropdownToggle placement="bottom-end" className="py-0 pe-0" caret={false}>
        <CAvatar src={photoUrl || avatar8} size="md" />
      </CDropdownToggle>
      <CDropdownMenu className="pt-0" placement="bottom-end">
        <CDropdownHeader className="bg-body-secondary fw-semibold mb-2">
          {user?.name || user?.email || 'Account'}
        </CDropdownHeader>
        <CDropdownItem role="button" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
          <CIcon icon={cilUser} className="me-2" />
          Profile
        </CDropdownItem>
        <CDropdownItem role="button" onClick={() => navigate('/profile?tab=settings')} style={{ cursor: 'pointer' }}>
          <CIcon icon={cilSettings} className="me-2" />
          Settings
        </CDropdownItem>
        <CDropdownDivider />
        <CDropdownItem role="button" onClick={handleLogout} style={{ cursor: 'pointer' }}>
          <CIcon icon={cilAccountLogout} className="me-2" />
          Log out
        </CDropdownItem>
      </CDropdownMenu>
    </CDropdown>
  )
}

export default AppHeaderDropdown
