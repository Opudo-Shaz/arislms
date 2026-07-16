import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardGroup,
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
import { cilLockLocked, cilUser } from '@coreui/icons'
import { Eye, EyeOff } from 'lucide-react'
import Swal from 'sweetalert2'
import arislmsLogo from '../../../assets/brand/arislms_logo_fit.png'
import { useAuth } from '../../../context/AuthContext'
import { ApiError } from '../../../api'
import { forgotPassword } from '../../../api/authApi'

const Login = () => {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Safely determine redirect location
  // Only use location.state if it exists and appears valid (has pathname)
  // Otherwise default to dashboard to prevent redirecting to stale URLs from previous users
  const getRedirectPath = () => {
    const fromLocation = location.state?.from?.pathname
    
    // Validate that the path starts with / and doesn't contain invalid characters
    // Default to /dashboard if no valid path is found
    if (fromLocation && typeof fromLocation === 'string' && fromLocation.startsWith('/')) {
      return fromLocation
    }
    return '/dashboard'
  }

  const from = getRedirectPath()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleForgotPassword = async () => {
    const { isConfirmed } = await Swal.fire({
      title: 'Forgot password?',
      text: "Enter your account email and we'll send you a reset link.",
      input: 'email',
      inputPlaceholder: 'your@email.com',
      inputAttributes: { autocomplete: 'email' },
      showCancelButton: true,
      confirmButtonText: 'Send reset link',
      confirmButtonColor: '#321fdb',
      cancelButtonText: 'Cancel',
      showLoaderOnConfirm: true,
      preConfirm: async (value) => {
        const trimmed = value?.trim().toLowerCase()
        if (!trimmed) {
          Swal.showValidationMessage('Please enter your email address')
          return false
        }
        try {
          await forgotPassword(trimmed)
        } catch (err) {
          const msg =
            err?.status === 404
              ? 'No account found for that email address.'
              : 'A system error prevented sending the reset email. Please try again later.'
          Swal.showValidationMessage(msg)
          return false
        }
      },
      allowOutsideClick: () => !Swal.isLoading(),
    })

    if (isConfirmed) {
      Swal.fire({
        icon: 'success',
        title: 'Check your inbox',
        text: 'If an account exists for that email, a reset link has been sent. It expires in 30 minutes.',
        confirmButtonColor: '#321fdb',
      })
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      // Clear any stale session data before redirecting
      sessionStorage.clear()
      // Redirect to the target location, clearing the login page from history
      // This ensures the user cannot go back to login after a successful login
      navigate(from, { replace: true, state: undefined })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Invalid email or password.')
      } else if (err instanceof ApiError && err.status === 0) {
        setError('Cannot reach the server. Please try again.')
      } else {
        setError(err.message || 'Login failed. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={8}>
            <CCardGroup>
              <CCard className="p-4">
                <CCardBody>
                  <CForm onSubmit={handleSubmit}>
                    <h1>Login</h1>
                    <p className="text-body-secondary">Sign In to your account</p>
                    {error ? (
                      <CAlert color="danger" className="py-2" dismissible onClose={() => setError('')}>
                        {error}
                      </CAlert>
                    ) : null}
                    <CInputGroup className="mb-3">
                      <CInputGroupText>
                        <CIcon icon={cilUser} />
                      </CInputGroupText>
                      <CFormInput
                        type="email"
                        placeholder="Email"
                        autoComplete="username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </CInputGroup>
                    <CInputGroup className="mb-4">
                      <CInputGroupText>
                        <CIcon icon={cilLockLocked} />
                      </CInputGroupText>
                      <CFormInput
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <CInputGroupText
                        role="button"
                        title={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((v) => !v)}
                        style={{ cursor: 'pointer' }}
                      >
                        {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                      </CInputGroupText>
                    </CInputGroup>
                    <CRow>
                      <CCol xs={6}>
                        <CButton
                          color="primary"
                          type="submit"
                          className="px-4"
                          disabled={submitting}
                        >
                          {submitting ? <CSpinner size="sm" /> : 'Login'}
                        </CButton>
                      </CCol>
                      <CCol xs={6} className="text-right">
                        <CButton color="link" className="px-0" type="button" onClick={handleForgotPassword}>
                          Forgot password?
                        </CButton>
                      </CCol>
                    </CRow>
                  </CForm>
                </CCardBody>
              </CCard>
              <CCard className="text-white bg-primary py-5" style={{ width: '44%' }}>
                <CCardBody className="text-center">
                  <div>
                    <img
                      src={arislmsLogo}
                      alt="ARIS LMS Logo"
                      style={{ maxWidth: '100%', height: 'auto', marginBottom: '1.5rem' }}
                    />
                    <p>
                      Loan Management System administration portal. Sign in with your staff
                      credentials to manage clients, loans, payments, and accounting.
                    </p>
                    {/* <Link to="/register">
                      <CButton color="primary" className="mt-3" active tabIndex={-1}>
                        Register Now!
                      </CButton>
                    </Link> */}
                  </div>
                </CCardBody>
              </CCard>
            </CCardGroup>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default Login
