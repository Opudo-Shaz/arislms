/**
 * Client self-service portal sign-in: phone number → one-time code.
 *
 * Step 1 sends a code by SMS (or email, if the client has a valid one on
 * file — the backend silently falls back to SMS otherwise). Step 2 verifies
 * it and starts a client session. The backend replies identically for
 * unregistered numbers, so this page never says whether a number exists.
 *
 * @component
 */

import React, { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CButtonGroup,
  CCard,
  CCardBody,
  CCardGroup,
  CCol,
  CContainer,
  CForm,
  CFormCheck,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilPhone } from '@coreui/icons'
import arislmsLogo from '../../assets/brand/arislms_logo_dark.png'
import { PORTAL_NOTICE_KEY, useClientAuth } from '../../context/ClientAuthContext'
import { PORTAL_ACCESS_DENIED } from '../../api/portalHttp'

/** Sign-out reason left by ClientAuthContext when access was withdrawn mid-session. */
const takeStoredNotice = () => {
  try {
    const notice = sessionStorage.getItem(PORTAL_NOTICE_KEY)
    sessionStorage.removeItem(PORTAL_NOTICE_KEY)
    return notice || ''
  } catch {
    return ''
  }
}

const RESEND_SECONDS = 60

const PortalLogin = () => {
  const { isAuthenticated, requestOtp, verifyOtp } = useClientAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [phone, setPhone] = useState('')
  const [channel, setChannel] = useState('sms')
  const [challenge, setChallenge] = useState(null) // { otpToken, channel }
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  // Why the account can't use the portal (after a verified code, or a withdrawn session).
  const [accessNotice, setAccessNotice] = useState(takeStoredNotice)
  const [submitting, setSubmitting] = useState(false)
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return undefined
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const from = location.state?.from?.pathname
  const destination = from && from.startsWith('/portal/') && from !== '/portal/login' ? from : '/portal/dashboard'

  if (isAuthenticated) return <Navigate to={destination} replace />

  const sendCode = async () => {
    setError('')
    setAccessNotice('')
    setSubmitting(true)
    try {
      const result = await requestOtp(phone.trim(), channel)
      setChallenge({ otpToken: result.otpToken, channel })
      setInfo(
        channel === 'email'
          ? 'If this number is registered, we sent a code to the email on your account (or by SMS if no valid email is saved).'
          : 'If this number is registered, we sent a code by SMS.',
      )
      setResendIn(RESEND_SECONDS)
    } catch (err) {
      setError(err?.message || 'Could not send a code. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRequest = (e) => {
    e.preventDefault()
    sendCode()
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await verifyOtp(challenge.otpToken, code)
      navigate(destination, { replace: true })
    } catch (err) {
      if (err?.data?.code === PORTAL_ACCESS_DENIED) {
        // Correct code, but the account can't use the portal — explain why.
        setChallenge(null)
        setCode('')
        setInfo('')
        setAccessNotice(err.message)
      } else {
        setError(err?.message || 'Verification failed. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const startOver = () => {
    setChallenge(null)
    setCode('')
    setError('')
    setInfo('')
  }

  return (
    <div className="login-page-bg min-vh-100 d-flex flex-row align-items-center">
      <CContainer className="px-3">
        <CRow className="justify-content-center">
          <CCol md={9} lg={8}>
            <CCardGroup className="d-flex flex-column flex-md-row">
              <CCard className="p-3 p-md-4 order-last order-md-first">
                <CCardBody>
                  {/* Distinct keys so switching steps mounts fresh DOM. Otherwise React reuses the
                      clicked <button> (e.g. "Use a different number") as the other step's submit
                      button mid-click, and the browser's default action then submits that form. */}
                  {!challenge ? (
                    <CForm key="request" onSubmit={handleRequest}>
                      <h1 className="h2">Client sign in</h1>
                      <p className="text-body-secondary">
                        Enter the phone number registered with us and we&apos;ll send you a one-time code.
                      </p>
                      {accessNotice ? (
                        <CAlert color="warning" className="py-2" dismissible onClose={() => setAccessNotice('')}>
                          <div className="fw-semibold">You can&apos;t sign in right now</div>
                          {accessNotice}
                        </CAlert>
                      ) : null}
                      {error ? (
                        <CAlert color="danger" className="py-2" dismissible onClose={() => setError('')}>
                          {error}
                        </CAlert>
                      ) : null}
                      <CInputGroup className="mb-3">
                        <CInputGroupText>
                          <CIcon icon={cilPhone} />
                        </CInputGroupText>
                        <CFormInput
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="e.g. 0712 345 678"
                          aria-label="Phone number"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          autoFocus
                          required
                        />
                      </CInputGroup>
                      <div className="mb-4">
                        <div className="small text-body-secondary mb-1">Send my code by</div>
                        <CButtonGroup role="group" aria-label="Delivery method">
                          <CFormCheck
                            type="radio"
                            button={{ color: 'success', variant: 'outline', size: 'sm' }}
                            name="otp-channel"
                            id="otp-channel-sms"
                            autoComplete="off"
                            label="SMS"
                            checked={channel === 'sms'}
                            onChange={() => setChannel('sms')}
                          />
                          <CFormCheck
                            type="radio"
                            button={{ color: 'success', variant: 'outline', size: 'sm' }}
                            name="otp-channel"
                            id="otp-channel-email"
                            autoComplete="off"
                            label="Email"
                            checked={channel === 'email'}
                            onChange={() => setChannel('email')}
                          />
                        </CButtonGroup>
                        <div className="form-text">Email works if a valid email address is saved on your account.</div>
                      </div>
                      <CButton color="primary" type="submit" className="px-4" disabled={submitting || !phone.trim()}>
                        {submitting ? <CSpinner size="sm" /> : 'Send code'}
                      </CButton>
                    </CForm>
                  ) : (
                    <CForm key="verify" onSubmit={handleVerify}>
                      <h1 className="h2">Enter your code</h1>
                      {info ? <p className="text-body-secondary">{info}</p> : null}
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
                          aria-label="Verification code"
                          value={code}
                          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                          maxLength={10}
                          autoFocus
                          required
                        />
                      </CInputGroup>
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        <CButton color="primary" type="submit" className="px-4" disabled={submitting || code.length < 4}>
                          {submitting ? <CSpinner size="sm" /> : 'Verify & sign in'}
                        </CButton>
                        <CButton
                          color="link"
                          className="px-0 ms-sm-auto"
                          type="button"
                          onClick={sendCode}
                          disabled={submitting || resendIn > 0}
                        >
                          {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                        </CButton>
                      </div>
                      <CButton color="link" className="px-0 mt-2" type="button" onClick={startOver} disabled={submitting}>
                        Use a different number
                      </CButton>
                    </CForm>
                  )}
                </CCardBody>
              </CCard>
              <CCard className="text-white bg-primary py-4 py-md-5 login-brand-card order-first order-md-last">
                <CCardBody className="text-center d-flex flex-column justify-content-center">
                  <img
                    src={arislmsLogo}
                    alt="ARIS LMS Logo"
                    className="mx-auto"
                    style={{ maxWidth: '80%', height: 'auto', marginBottom: '1.25rem' }}
                  />
                  <p className="mb-3">
                    View your loans and payments, check your credit score, apply for a loan and report
                    repayments — all in one place.
                  </p>
                  <div className="small">
                    <Link to="/" className="text-white">Back to home</Link>
                    <span className="mx-2">·</span>
                    <Link to="/login" className="text-white">Staff sign in</Link>
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

export default PortalLogin
