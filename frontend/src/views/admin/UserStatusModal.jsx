/**
 * UserStatusModal
 *
 * Admin/manager modal to change a user's account status
 * (active/inactive/suspended). Mirrors the backend
 * `PATCH /users/{id}/status` contract { status }.
 *
 * @module views/admin/UserStatusModal
 */

import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CForm,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'

import { useUpdateUserStatus } from '../../hooks/useUsers'
import { USER_STATUS, enumLabel } from '../../constants/enums'

const UserStatusModal = ({ visible, user, onClose }) => {
  const statusMutation = useUpdateUserStatus()
  const [status, setStatus] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (visible) {
      setStatus(user?.status || USER_STATUS.values[0])
      setError(null)
    }
  }, [visible, user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await statusMutation.mutateAsync({ id: user.id, status })
      onClose()
    } catch (err) {
      setError(err)
    }
  }

  return (
    <CModal visible={visible} onClose={onClose} alignment="center">
      <CForm onSubmit={handleSubmit}>
        <CModalHeader>
          <CModalTitle>Update User Status</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError(null)}>
              {error.message || 'Failed to update status.'}
            </CAlert>
          )}
          <p className="text-body-secondary">
            Set the account status for <strong>{user?.email}</strong>.
          </p>
          <CFormLabel>Status *</CFormLabel>
          <CFormSelect value={status} onChange={(e) => setStatus(e.target.value)} required>
            {USER_STATUS.values.map((v) => (
              <option key={v} value={v}>
                {enumLabel(USER_STATUS, v)}
              </option>
            ))}
          </CFormSelect>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={onClose}>
            Cancel
          </CButton>
          <CButton color="primary" type="submit" disabled={statusMutation.isPending}>
            {statusMutation.isPending && <CSpinner size="sm" className="me-2" />}
            Save Status
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

UserStatusModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  user: PropTypes.object,
  onClose: PropTypes.func.isRequired,
}

export default UserStatusModal
