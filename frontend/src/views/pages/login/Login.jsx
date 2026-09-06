import React, { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
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
import arislmsLogo from '../../../assets/brand/arislms_logo_dark.png'
import { useAuth } from '../../../context/AuthContext'
import { ApiError } from '../../../api'
import { forgotPassword } from '../../../api/authApi'

const Login = () => {
  const { login, verifyOtp, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Already logged in — send them to where they came from or the dashboard.
  if (isAuthenticated) {
    const destination = location.state?.from?.pathname || '/dashboard'
    return <Navigate to={destination} replace />
  }

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

  // OTP step state — populated when the backend requires a one-time code.
  const [otpToken, setOtpToken] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const otpRequired = Boolean(otpToken)

  const handleForgotPassword = async () => {
    const { isConfirmed } = await Swal.fire({
      title: 'Forgot password?',
      text: "Enter your account email and we'll send you a reset link.",
      input: 'email',
      inputPlaceholder: 'your@email.com',
      inputAttributes: { autocomplete: 'email' },
      showCancelButton: true,
      confirmButtonText: 'Send reset link',
      confirmButtonColor: '#5dcae2',
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
      const result = await login(email.trim(), password)
      // Backend requires a one-time code — switch to the OTP step instead of redirecting.
      if (result?.otpRequired) {
        setOtpToken(result.otpToken)
        setOtpCode('')
        return
      }
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

  const handleVerifyOtp = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await verifyOtp({ otpToken, code: otpCode.trim() })
      sessionStorage.clear()
      navigate(from, { replace: true, state: undefined })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Challenge token expired/invalid — send the user back to the password step.
        setError('Your verification session has expired. Please sign in again.')
        setOtpToken('')
        setOtpCode('')
      } else if (err instanceof ApiError && err.status === 0) {
        setError('Cannot reach the server. Please try again.')
      } else {
        setError(err.message || 'Verification failed. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleResendOtp = async () => {
    setError('')
    setSubmitting(true)
    try {
      const result = await login(email.trim(), password)
      if (result?.otpRequired) {
        setOtpToken(result.otpToken)
        setOtpCode('')
      }
    } catch (err) {
      setError(err.message || 'Could not resend the code. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBackToLogin = () => {
    setError('')
    setOtpToken('')
    setOtpCode('')
    setPassword('')
  }

  return (
    <div className="login-page-bg min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={8}>
            <CCardGroup className="d-flex flex-column flex-md-row">
              <CCard className="p-4 order-last order-md-first">
                <CCardBody>
                  {otpRequired ? (
                    <CForm onSubmit={handleVerifyOtp}>
                      <h1>Verify code</h1>
                      <p className="text-body-secondary">
                        Enter the verification code we just sent you to finish signing in.
                      </p>
                      {error ? (
                        <CAlert color="danger" className="py-2" dismissible onClose={() => setError('')}>
                          {error}
                        </CAlert>
                      ) : null}
                      <CInputGroup className="mb-4">
                        <CInputGroupText>
                          <CIcon icon={cilLockLocked} />
                        </CInputGroupText>
                        <CFormInput
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="Verification code"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                          autoFocus
                          required
                        />
                      </CInputGroup>
                      <CRow className="align-items-center">
                        <CCol xs={6}>
                          <CButton
                            color="primary"
                            type="submit"
                            className="px-4"
                            disabled={submitting || !otpCode}
                          >
                            {submitting ? <CSpinner size="sm" /> : 'Verify'}
                          </CButton>
                        </CCol>
                        <CCol xs={6} className="text-right">
                          <CButton
                            color="link"
                            className="px-0"
                            type="button"
                            onClick={handleResendOtp}
                            disabled={submitting}
                          >
                            Resend code
                          </CButton>
                        </CCol>
                      </CRow>
                      <CRow className="mt-2">
                        <CCol xs={12}>
                          <CButton
                            color="link"
                            className="px-0"
                            type="button"
                            onClick={handleBackToLogin}
                            disabled={submitting}
                          >
                            Back to login
                          </CButton>
                        </CCol>
                      </CRow>
                    </CForm>
                  ) : (
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
                  )}
                </CCardBody>
              </CCard>
              <CCard className="text-white bg-primary py-5 login-brand-card order-first order-md-last">
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
