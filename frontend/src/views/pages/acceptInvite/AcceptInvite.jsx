/**
 * AcceptInvite
 *
 * Public registration page reached via an invite-only link
 * (`/accept-invite?token=...`). Verifies the token on mount to prefill
 * email/role (read-only) and any name/phone already captured on the
 * invite; the invitee fills in whatever is missing plus a password.
 * Submission passes through the same validation as normal user creation.
 *
 * @module views/pages/acceptInvite/AcceptInvite
 */

import React, { useEffect, useState } from 'react'
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

import { useVerifyInvitation, useAcceptInvitation } from '../../../hooks/useInvitations'
import { ApiError } from '../../../api'
import arislmsLogo from '../../../assets/brand/arislms_logo_fit.png'

const AcceptInvite = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const { data: invitation, isLoading, error: verifyError } = useVerifyInvitation(token)
  const acceptMutation = useAcceptInvitation()

  const [form, setForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    phone: '',
    id_number: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (invitation) {
      setForm((f) => ({
        ...f,
        first_name: invitation.first_name || '',
        middle_name: invitation.middle_name || '',
        last_name: invitation.last_name || '',
        phone: invitation.phone || '',
      }))
    }
  }, [invitation])

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  if (!token) {
    return (
      <div className="app-view-bg min-vh-100 d-flex flex-row align-items-center">
        <CContainer>
          <CRow className="justify-content-center">
            <CCol md={5}>
              <CAlert color="danger">
                Invalid invitation link — no token found. <Link to="/login">Back to login</Link>
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

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    try {
      await acceptMutation.mutateAsync({
        token,
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim() || null,
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || null,
        id_number: form.id_number.trim() || null,
        password: form.password,
      })
      setSuccess(true)
      setTimeout(() => navigate('/login', { replace: true }), 3000)
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErrors = err.data?.errors
        if (fieldErrors?.length) {
          setError(fieldErrors.map((m) => (typeof m === 'string' ? m : m.message)).join('\n'))
        } else {
          setError(err.data?.message || err.message || 'Registration failed.')
        }
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    }
  }

  return (
    <div className="app-view-bg min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={6}>
            <div className="text-center mb-4">
              <img src={arislmsLogo} alt="ARISLMS" style={{ height: 48 }} />
            </div>

            <CCard className="p-4">
              <CCardBody>
                <h1 className="h4 mb-1">Complete your registration</h1>
                <p className="text-body-secondary mb-4">You&apos;ve been invited to join ARISLMS.</p>

                {isLoading && (
                  <div className="text-center py-4">
                    <CSpinner color="primary" />
                  </div>
                )}

                {!isLoading && verifyError && (
                  <CAlert color="danger">
                    {verifyError.message || 'This invitation link is invalid or has expired.'}{' '}
                    <Link to="/login">Back to login</Link>
                  </CAlert>
                )}

                {!isLoading && invitation && !success && (
                  <CForm onSubmit={handleSubmit}>
                    {error && (
                      <CAlert
                        style={{ whiteSpace: 'pre-line' }}
                        color="danger"
                        dismissible
                        onClose={() => setError('')}
                      >
                        {error}
                      </CAlert>
                    )}

                    <CRow className="g-3 mb-3">
                      <CCol md={6}>
                        <label className="form-label">Email</label>
                        <CFormInput value={invitation.email} readOnly disabled />
                      </CCol>
                      <CCol md={6}>
                        <label className="form-label">Role</label>
                        <CFormInput value={invitation.role_name || `Role ${invitation.role}`} readOnly disabled />
                      </CCol>

                      <CCol md={4}>
                        <label className="form-label">First name *</label>
                        <CFormInput value={form.first_name} onChange={setField('first_name')} required />
                      </CCol>
                      <CCol md={4}>
                        <label className="form-label">Middle name</label>
                        <CFormInput value={form.middle_name} onChange={setField('middle_name')} />
                      </CCol>
                      <CCol md={4}>
                        <label className="form-label">Last name *</label>
                        <CFormInput value={form.last_name} onChange={setField('last_name')} required />
                      </CCol>

                      <CCol md={6}>
                        <label className="form-label">Phone{invitation.phone ? '' : ' *'}</label>
                        <CFormInput
                          value={form.phone}
                          onChange={setField('phone')}
                          required={!invitation.phone}
                          placeholder="1234567"
                        />
                      </CCol>
                      <CCol md={6}>
                        <label className="form-label">ID number</label>
                        <CFormInput value={form.id_number} onChange={setField('id_number')} maxLength={50} />
                      </CCol>
                    </CRow>

                    <CInputGroup className="mb-3">
                      <CInputGroupText>
                        <CIcon icon={cilLockLocked} />
                      </CInputGroupText>
                      <CFormInput
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Password"
                        autoComplete="new-password"
                        value={form.password}
                        onChange={setField('password')}
                        required
                      />
                      <CInputGroupText
                        role="button"
                        style={{ cursor: 'pointer' }}
                        title={showPassword ? 'Hide' : 'Show'}
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                      </CInputGroupText>
                    </CInputGroup>

                    <CInputGroup className="mb-4">
                      <CInputGroupText>
                        <CIcon icon={cilLockLocked} />
                      </CInputGroupText>
                      <CFormInput
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Confirm password"
                        autoComplete="new-password"
                        value={form.confirmPassword}
                        onChange={setField('confirmPassword')}
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
                      <CButton color="primary" type="submit" disabled={acceptMutation.isPending}>
                        {acceptMutation.isPending ? <CSpinner size="sm" className="me-2" /> : null}
                        Complete registration
                      </CButton>
                    </div>
                  </CForm>
                )}

                {success && (
                  <CAlert color="success">
                    <strong>Registration complete!</strong> Redirecting you to login…
                  </CAlert>
                )}

                <div className="text-center mt-3">
                  <Link to="/login" className="text-body-secondary small">
                    Back to login
                  </Link>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default AcceptInvite
