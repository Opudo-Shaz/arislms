import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked } from '@coreui/icons'
import { Eye, EyeOff } from 'lucide-react'
import { resetPassword } from '../../../api/authApi'
import { ApiError } from '../../../api'
import arislmsLogo from '../../../assets/brand/arislms_logo_fit.png'

const ResetPassword = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (!token) {
    return (
      <div style={{ background: '#321fdb' }} className="min-vh-100 d-flex flex-row align-items-center">
        <CContainer>
          <CRow className="justify-content-center">
            <CCol md={5}>
              <CAlert color="danger">
                Invalid reset link — no token found.{' '}
                <Link to="/login">Back to login</Link>
              </CAlert>
            </CCol>
          </CRow>
        </CContainer>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      await resetPassword(token, newPassword)
      setSuccess(true)
      setTimeout(() => navigate('/login', { replace: true }), 3000)
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErrors = err.data?.errors
        if (fieldErrors?.length) {
          setError(fieldErrors.map((e) => e.message).join('\n'))
        } else {
          setError(err.data?.message || err.message || 'Password reset failed.')
        }
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ background: '#321fdb' }} className="min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={5}>
            <div className="text-center mb-4">
              <img src={arislmsLogo} alt="ARISLMS" style={{ height: 48 }} />
            </div>

            <CCard className="p-4">
              <CCardBody>
                <h1 className="h4 mb-1">Set new password</h1>
                <p className="text-body-secondary mb-4">
                  Choose a strong password for your account.
                </p>

                {success ? (
                  <CAlert color="success">
                    <strong>Password updated!</strong> Redirecting you to login…
                  </CAlert>
                ) : (
                  <CForm onSubmit={handleSubmit}>
                    {error && (
                      <CAlert style={{ whiteSpace: 'pre-line' }} color="danger" dismissible onClose={() => setError('')}>
                        {error}
                      </CAlert>
                    )}

                    <CInputGroup className="mb-3">
                      <CInputGroupText>
                        <CIcon icon={cilLockLocked} />
                      </CInputGroupText>
                      <CFormInput
                        type={showNew ? 'text' : 'password'}
                        placeholder="New password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                      <CInputGroupText
                        role="button"
                        style={{ cursor: 'pointer' }}
                        title={showNew ? 'Hide' : 'Show'}
                        onClick={() => setShowNew((v) => !v)}
                      >
                        {showNew ? <Eye size={16} /> : <EyeOff size={16} />}
                      </CInputGroupText>
                    </CInputGroup>

                    <CInputGroup className="mb-4">
                      <CInputGroupText>
                        <CIcon icon={cilLockLocked} />
                      </CInputGroupText>
                      <CFormInput
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Confirm new password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                      <CInputGroupText
                        role="button"
                        style={{ cursor: 'pointer' }}
                        title={showConfirm ? 'Hide' : 'Show'}
                        onClick={() => setShowConfirm((v) => !v)}
                      >
                        {showConfirm ? <Eye size={16} /> : <EyeOff size={16} />}
                      </CInputGroupText>
                    </CInputGroup>

                    <div className="d-grid">
                      <CButton color="primary" type="submit" disabled={submitting}>
                        {submitting ? <CSpinner size="sm" className="me-2" /> : null}
                        Reset password
                      </CButton>
                    </div>

                    <div className="text-center mt-3">
                      <Link to="/login" className="text-body-secondary small">
                        Back to login
                      </Link>
                    </div>
                  </CForm>
                )}
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default ResetPassword
