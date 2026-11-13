import React, { useEffect, useState } from 'react'
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
  CFormLabel,
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
import OtpCodeInput from '../../portal/OtpCodeInput'

// Client-side pause between resends (the backend doesn't enforce one for staff).
const OTP_RESEND_SECONDS = 30
// Backend default for `auth.otp.length`; the login response carries the configured value.
const DEFAULT_OTP_LENGTH = 6

const CHANNEL_LABELS = { sms: 'SMS', whatsapp: 'WhatsApp', email: 'email' }
const channelLabel = (channel) => CHANNEL_LABELS[channel] ?? channel

const formatCountdown = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

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
  const [otpLength, setOtpLength] = useState(DEFAULT_OTP_LENGTH)
  const [otpChannel, setOtpChannel] = useState(null) // 'sms' | 'whatsapp' | 'email' | null
  const [otpAlternative, setOtpAlternative] = useState(null) // channel offered if the code never arrives
  const [notice, setNotice] = useState('')
  const [otpKey, setOtpKey] = useState(0) // remounts the digit boxes to refocus the first one
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return undefined
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const handleForgotPassword = async () => {
    const { isConfirmed } = await Swal.fire({
      title: 'Forgot password?',
      text: "Enter your account email and we'll send you a reset link.",
      input: 'email',
      inputPlaceholder: 'your@email.com',
      inputAttributes: { autocomplete: 'email' },
      showCancelButton: true,
      confirmButtonText: 'Send reset link',
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
        applyChallenge(result)
        setOtpCode('')
        setNotice('')
        setResendIn(OTP_RESEND_SECONDS)
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

  const submitOtp = async (code) => {
    if (submitting) return
    setError('')
    setNotice('')
    setSubmitting(true)
    try {
      await verifyOtp({ otpToken, code })
      sessionStorage.clear()
      navigate(from, { replace: true, state: undefined })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Challenge token expired/invalid — send the user back to the password step.
        setError('Your verification session has expired. Please sign in again.')
        setOtpToken('')
        setOtpCode('')
      } else {
        setError(
          err instanceof ApiError && err.status === 0
            ? 'Cannot reach the server. Please try again.'
            : err.message || 'Verification failed. Please try again.',
        )
        setOtpCode('')
        setOtpKey((k) => k + 1)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerifyOtp = (event) => {
    event.preventDefault()
    if (otpCode.length === otpLength) submitOtp(otpCode)
  }

  // Submit as soon as the last digit lands (typed, pasted or autofilled).
  const handleOtpChange = (next) => {
    setOtpCode(next)
    if (next.length === otpLength) submitOtp(next)
  }

  const applyChallenge = (result) => {
    setOtpToken(result.otpToken)
    setOtpLength(result.otpLength || DEFAULT_OTP_LENGTH)
    setOtpChannel(result.otpChannel || null)
    setOtpAlternative(result.otpAlternative || null)
  }

  // `channel` is set when the user asks for the code on a different channel.
  const handleResendOtp = async (channel) => {
    setError('')
    setNotice('')
    setSubmitting(true)
    try {
      const result = await login(email.trim(), password, channel || otpChannel)
      if (result?.otpRequired) {
        applyChallenge(result)
        setOtpCode('')
        setOtpKey((k) => k + 1)
        setNotice(channel ? `A new code has been sent by ${channelLabel(result.otpChannel)}.` : 'A new code has been sent.')
        setResendIn(OTP_RESEND_SECONDS)
      }
    } catch (err) {
      setError(err.message || 'Could not resend the code. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBackToLogin = () => {
    setError('')
    setNotice('')
    setResendIn(0)
    setOtpToken('')
    setOtpCode('')
    setPassword('')
  }

  const alert = error ? (
    <CAlert color="danger" className="py-2 portal-alert" dismissible onClose={() => setError('')}>
      {error}
    </CAlert>
  ) : null

  return (
    <div className="login-page-bg portal-login min-vh-100 d-flex flex-row align-items-center">
      <CContainer className="px-3">
        <CRow className="justify-content-center">
          <CCol md={10} lg={8}>
            <CCardGroup className="d-flex portal-card-group">
              <CCard className="portal-form-panel" data-coreui-theme="dark">
                <CCardBody>
                  {otpRequired ? (
                    <CForm onSubmit={handleVerifyOtp}>
                      <h1 className="portal-heading">Enter your code</h1>
                      <p className="portal-subtext">
                        We sent {otpLength === 8 ? 'an' : 'a'} {otpLength}-digit code{' '}
                        {otpChannel === 'email' ? (
                          <>
                            to <strong>{email.trim()}</strong>
                          </>
                        ) : otpChannel ? (
                          `by ${channelLabel(otpChannel)} to the phone number on your account`
                        ) : (
                          <>
                            for <strong>{email.trim()}</strong>
                          </>
                        )}
                        . Enter it below to finish signing in.
                      </p>
                      {alert}
                      <div aria-live="polite" className="portal-help">
                        {notice}
                      </div>
                      <OtpCodeInput
                        key={otpKey}
                        value={otpCode}
                        onChange={handleOtpChange}
                        length={otpLength}
                        disabled={submitting}
                        autoFocus
                      />
                      <CButton
                        type="submit"
                        className="portal-primary-btn mt-4"
                        disabled={submitting || otpCode.length !== otpLength}
                      >
                        {submitting ? (
                          <>
                            <CSpinner size="sm" className="me-2" aria-hidden="true" />
                            Verifying…
                          </>
                        ) : (
                          'Verify and sign in'
                        )}
                      </CButton>
                      <div className="portal-linkrow">
                        <button type="button" className="portal-link" onClick={handleBackToLogin} disabled={submitting}>
                          Back to login
                        </button>
                        {resendIn > 0 ? (
                          <span className="portal-help m-0">Resend in {formatCountdown(resendIn)}</span>
                        ) : (
                          <span className="d-inline-flex flex-wrap gap-3">
                            <button
                              type="button"
                              className="portal-link"
                              onClick={() => handleResendOtp()}
                              disabled={submitting}
                            >
                              Resend code
                            </button>
                            {otpAlternative ? (
                              <button
                                type="button"
                                className="portal-link"
                                onClick={() => handleResendOtp(otpAlternative)}
                                disabled={submitting}
                              >
                                Try {channelLabel(otpAlternative)} instead
                              </button>
                            ) : null}
                          </span>
                        )}
                      </div>
                    </CForm>
                  ) : (
                    <CForm onSubmit={handleSubmit}>
                      <h1 className="portal-heading">Staff sign in</h1>
                      <p className="portal-subtext">Sign in to your account</p>
                      {alert}
                      <CFormLabel htmlFor="staff-email" className="portal-label">
                        Email
                      </CFormLabel>
                      <CInputGroup className="mb-3">
                        <CInputGroupText className="portal-phone-prefix">
                          <CIcon icon={cilUser} />
                        </CInputGroupText>
                        <CFormInput
                          id="staff-email"
                          type="email"
                          placeholder="you@company.com"
                          autoComplete="username"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </CInputGroup>
                      <CFormLabel htmlFor="staff-password" className="portal-label">
                        Password
                      </CFormLabel>
                      <CInputGroup className="mb-4">
                        <CInputGroupText className="portal-phone-prefix">
                          <CIcon icon={cilLockLocked} />
                        </CInputGroupText>
                        <CFormInput
                          id="staff-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Password"
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                        <CInputGroupText
                          className="portal-phone-prefix"
                          role="button"
                          title={showPassword ? 'Hide password' : 'Show password'}
                          onClick={() => setShowPassword((v) => !v)}
                          style={{ cursor: 'pointer' }}
                        >
                          {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                        </CInputGroupText>
                      </CInputGroup>
                      <CButton type="submit" className="portal-primary-btn" disabled={submitting}>
                        {submitting ? <CSpinner size="sm" /> : 'Login'}
                      </CButton>
                      <div className="portal-linkrow">
                        <button type="button" className="portal-link" onClick={handleForgotPassword}>
                          Forgot password?
                        </button>
                      </div>
                    </CForm>
                  )}
                  <p className="portal-footer-link">
                    Are you a client? <Link to="/portal/login">Client sign in</Link>
                  </p>
                </CCardBody>
              </CCard>
              <CCard className="portal-brand-panel">
                <CCardBody className="d-flex flex-column justify-content-center text-center">
                  <img src={arislmsLogo} alt="ARIS LMS Logo" className="portal-brand-logo" />
                  <p className="mb-0">
                    Loan Management System administration portal. Sign in with your staff credentials to
                    manage clients, loans, payments, and accounting.
                  </p>
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
