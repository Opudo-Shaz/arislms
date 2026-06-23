/**
 * ResetPasswordModal
 *
 * Admin-only (role 1) modal to reset another user's password. Mirrors the
 * backend `POST /users/reset-password` contract { userId, email, newPassword }.
 *
 * @module views/admin/ResetPasswordModal
 */

import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'

import { useResetUserPassword } from '../../hooks/useUsers'

const ResetPasswordModal = ({ visible, user, onClose }) => {
  const resetMutation = useResetUserPassword()
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (visible) {
      setNewPassword('')
      setError(null)
      setDone(false)
    }
  }, [visible])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await resetMutation.mutateAsync({
        userId: user.id,
        email: user.email,
        newPassword,
      })
      setDone(true)
    } catch (err) {
      setError(err)
    }
  }

  return (
    <CModal visible={visible} onClose={onClose} alignment="center">
      <CForm onSubmit={handleSubmit}>
        <CModalHeader>
          <CModalTitle>Reset Password</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError(null)}>
              {error.message || 'Failed to reset password.'}
            </CAlert>
          )}
          {done ? (
            <CAlert color="success" className="mb-0">
              Password reset successfully for {user?.email}.
            </CAlert>
          ) : (
            <>
              <p className="text-body-secondary">
                Set a new password for <strong>{user?.email}</strong>.
              </p>
              <CFormLabel>New password *</CFormLabel>
              <CFormInput
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={onClose}>
            {done ? 'Close' : 'Cancel'}
          </CButton>
          {!done && (
            <CButton color="warning" type="submit" disabled={resetMutation.isPending}>
              {resetMutation.isPending && <CSpinner size="sm" className="me-2" />}
              Reset Password
            </CButton>
          )}
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

ResetPasswordModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  user: PropTypes.object,
  onClose: PropTypes.func.isRequired,
}

ResetPasswordModal.defaultProps = {
  user: null,
}

export default ResetPasswordModal
