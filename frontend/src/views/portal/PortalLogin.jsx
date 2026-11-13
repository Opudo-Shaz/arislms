/**
 * Client self-service portal sign-in: mobile number → one-time code.
 *
 * The mobile number is always the identifier (Kenyan numbers, normalised to E.164).
 * Step 1 collects it, then reveals the delivery channel (SMS, WhatsApp or the email
 * saved on the account). Step 2 verifies the one-time code and starts a client session.
 * The backend replies identically for unregistered numbers, so this page never says
 * whether a number exists.
 *
 * @component
 */

import React, { useEffect, useRef, useState } from 'react'
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
import { cilLockLocked, cilNotes, cilSpeedometer, cilWallet } from '@coreui/icons'
import arislmsLogo from '../../assets/brand/arislms_logo_dark.png'
import { PORTAL_NOTICE_KEY, useClientAuth } from '../../context/ClientAuthContext'
import { PORTAL_ACCESS_DENIED } from '../../api/portalHttp'
import { formatInternational, formatLocal, isValidLocal, toE164, toLocalDigits } from '../../utils/kenyanPhone'
import OtpCodeInput from './OtpCodeInput'

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

const CHANNELS = [
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
]
const CHANNEL_STORAGE_KEY = 'portal.lastOtpChannel'
// Backend default for `auth.otp.length`; replaced by the real value from the first response.
const DEFAULT_CODE_LENGTH = 6
// Matches the backend's resend cooldown (portalAuthService RESEND_COOLDOWN_SECONDS): a resend
// requested sooner is silently skipped server-side, so a shorter countdown would be a lie.
const RESEND_SECONDS = 60
// Backend default for `auth.otp.ttl_minutes`; replaced by the real value from the first response.
const DEFAULT_OTP_TTL_MINUTES = 10

const readLastChannel = () => {
  try {
    const stored = localStorage.getItem(CHANNEL_STORAGE_KEY)
    return CHANNELS.some((c) => c.value === stored) ? stored : 'sms'
  } catch {
    return 'sms'
  }
}

const saveLastChannel = (channel) => {
  try {
    localStorage.setItem(CHANNEL_STORAGE_KEY, channel)
  } catch {
    // Storage unavailable (private mode, blocked): the preference just isn't remembered.
  }
}

const formatCountdown = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

const channelLabel = (value) => CHANNELS.find((c) => c.value === value)?.label ?? 'SMS'

const NETWORK_ERROR = "We couldn't reach the server. Check your connection and try again."

/** Friendly message for a failed "send code" request. */
const requestErrorMessage = (err, channel) => {
  if (err?.status === 0) return NETWORK_ERROR
  if (err?.status === 429) return 'Too many code requests. Please wait a few minutes and try again.'
  if (err?.status === 400 && err?.message) return err.message
  const other = channel === 'sms' ? 'WhatsApp' : 'SMS'
  return `We couldn't send your code. Try ${other} instead, or try again in a moment.`
}

/** Friendly message for a failed "verify code" request. */
const verifyErrorMessage = (err) => {
  if (err?.status === 0) return NETWORK_ERROR
  if (err?.status === 429) return 'Too many incorrect attempts. Please request a new code.'
  if (err?.status === 400 && /code/i.test(err?.message || '')) {
    const remaining = /(\d+) attempt/.exec(err.message)?.[1]
    return `That code isn't right or has expired. Check it and try again.${remaining ? ` ${remaining} attempt(s) left.` : ''}`
  }
  return err?.message || 'Verification failed. Please try again.'
}

const BENEFITS = [
  { icon: cilWallet, text: 'View your loans and payments' },
  { icon: cilSpeedometer, text: 'Check your credit score' },
  { icon: cilNotes, text: 'Apply for a loan and report repayments' },
]

const PortalLogin = () => {
  const { isAuthenticated, requestOtp, verifyOtp, verifyDevice } = useClientAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [local, setLocal] = useState('') // 9 national digits
  const [touched, setTouched] = useState(false)
  const [channel, setChannel] = useState(readLastChannel)
  const [challenge, setChallenge] = useState(null) // { otpToken, channel }
  const [ttlMinutes, setTtlMinutes] = useState(DEFAULT_OTP_TTL_MINUTES)
  const [codeLength, setCodeLength] = useState(DEFAULT_CODE_LENGTH)
  const [code, setCode] = useState('')
  const [codeKey, setCodeKey] = useState(0) // remounts the digit boxes to refocus the first one
  // Set when the code was right but this device is new: { stepUpToken }
  const [deviceCheck, setDeviceCheck] = useState(null)
  const [idLast4, setIdLast4] = useState('')
  const [error, setError] = useState('')
  // Why the account can't use the portal (after a verified code, or a withdrawn session).
  const [accessNotice, setAccessNotice] = useState(takeStoredNotice)
  const [submitting, setSubmitting] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const busyRef = useRef(false)

  useEffect(() => {
    if (resendIn <= 0) return undefined
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const from = location.state?.from?.pathname
  const destination = from && from.startsWith('/portal/') && from !== '/portal/login' ? from : '/portal/dashboard'

  if (isAuthenticated) return <Navigate to={destination} replace />

  const phoneValid = isValidLocal(local)
  const showPhoneError = touched && !phoneValid

  // Guards against double submits even before React re-renders the disabled state.
  const runExclusive = async (fn) => {
    if (busyRef.current) return
    busyRef.current = true
    setSubmitting(true)
    try {
      await fn()
    } finally {
      busyRef.current = false
      setSubmitting(false)
    }
  }

  const sendCode = (useChannel = channel) =>
    runExclusive(async () => {
      setError('')
      setAccessNotice('')
      try {
        const result = await requestOtp(toE164(local), useChannel)
        setChannel(useChannel)
        saveLastChannel(useChannel)
        setChallenge({ otpToken: result.otpToken, channel: useChannel })
        if (result.ttlMinutes) setTtlMinutes(result.ttlMinutes)
        if (result.otpLength) setCodeLength(result.otpLength)
        setCode('')
        setCodeKey((k) => k + 1)
        setResendIn(RESEND_SECONDS)
      } catch (err) {
        setError(requestErrorMessage(err, useChannel))
      }
    })

  const handleRequest = (e) => {
    e.preventDefault()
    setTouched(true)
    if (phoneValid) sendCode()
  }

  const startOver = () => {
    setChallenge(null)
    setDeviceCheck(null)
    setIdLast4('')
    setCode('')
    setError('')
    setResendIn(0)
  }

  const submitCode = (value) =>
    runExclusive(async () => {
      setError('')
      try {
        const result = await verifyOtp(challenge.otpToken, value)
        if (result?.stepUpRequired) {
          setDeviceCheck({ stepUpToken: result.stepUpToken })
          setIdLast4('')
          return
        }
        navigate(destination, { replace: true })
      } catch (err) {
        if (err?.data?.code === PORTAL_ACCESS_DENIED || err?.data?.code === 'DEVICE_STEP_UP_UNAVAILABLE') {
          // Correct code, but the account can't sign in — explain why.
          startOver()
          setAccessNotice(err.message)
        } else if (err?.status === 401) {
          startOver()
          setError('This sign-in session has expired. Please send a new code.')
        } else {
          setError(verifyErrorMessage(err))
          setCode('')
          setCodeKey((k) => k + 1)
        }
      }
    })

  const handleVerify = (e) => {
    e.preventDefault()
    if (code.length === codeLength) submitCode(code)
  }

  // Submit as soon as the last digit lands (typed, pasted or autofilled).
  const handleCodeChange = (next) => {
    setCode(next)
    if (next.length === codeLength && !busyRef.current) submitCode(next)
  }

  const handleDeviceCheck = (e) => {
    e.preventDefault()
    return runExclusive(async () => {
      setError('')
      try {
        await verifyDevice(deviceCheck.stepUpToken, idLast4.trim())
        navigate(destination, { replace: true })
      } catch (err) {
        const errCode = err?.data?.code
        if (errCode === 'DEVICE_STEP_UP_LOCKED' || err?.status === 401) {
          // Locked out, or the 5-minute window lapsed: start the sign-in again.
          startOver()
          setAccessNotice(err.message)
        } else {
          setError(err?.message || 'Verification failed. Please try again.')
        }
      }
    })
  }

  const handleChannelKeyDown = (e, index) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const nextIndex = (index + step + CHANNELS.length) % CHANNELS.length
    setChannel(CHANNELS[nextIndex].value)
    e.currentTarget.parentElement.children[nextIndex]?.focus()
  }

  const retryWithOther = challenge?.channel === 'sms' ? 'whatsapp' : 'sms'
  const errorAlert = error ? (
    <CAlert color="danger" className="py-2 portal-alert" dismissible onClose={() => setError('')}>
      {error}
    </CAlert>
  ) : null

  const renderRequestStep = () => (
    <CForm key="request" onSubmit={handleRequest} noValidate>
      <h1 className="portal-heading">Client sign in</h1>
      <p className="portal-subtext">Enter your mobile number and we&apos;ll send you a one-time code.</p>
      {accessNotice ? (
        <CAlert color="warning" className="py-2 portal-alert" dismissible onClose={() => setAccessNotice('')}>
          <div className="fw-semibold">You can&apos;t sign in right now</div>
          {accessNotice}
        </CAlert>
      ) : null}
      {errorAlert}
      <CFormLabel htmlFor="portal-mobile" className="portal-label">
        Mobile number
      </CFormLabel>
      <CInputGroup className="portal-phone-group">
        <CInputGroupText className="portal-phone-prefix">🇰🇪 +254</CInputGroupText>
        <CFormInput
          id="portal-mobile"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="712 345 678"
          value={formatLocal(local)}
          onChange={(e) => setLocal(toLocalDigits(e.target.value))}
          onBlur={() => setTouched(true)}
          invalid={showPhoneError}
          aria-describedby="portal-mobile-help"
          aria-invalid={showPhoneError}
          autoFocus
        />
      </CInputGroup>
      <div
        id="portal-mobile-help"
        aria-live="polite"
        className={`portal-help ${showPhoneError ? 'portal-help-error' : ''}`}
      >
        {showPhoneError
          ? 'Enter a valid Kenyan mobile number, e.g. 712 345 678.'
          : 'You can type 0712… or 712… — we\u2019ll format it.'}
      </div>

      {phoneValid ? (
        <div className="portal-channels">
          <div id="portal-channel-label" className="portal-label">
            Send my code by
          </div>
          <div role="radiogroup" aria-labelledby="portal-channel-label" className="portal-segmented">
            {CHANNELS.map((c, i) => {
              const selected = channel === c.value
              return (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  className={`portal-segment ${selected ? 'is-selected' : ''}`}
                  onClick={() => setChannel(c.value)}
                  onKeyDown={(e) => handleChannelKeyDown(e, i)}
                >
                  {selected ? (
                    <span className="portal-segment-check" aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                  {c.label}
                </button>
              )
            })}
          </div>
          <div aria-live="polite" className="portal-help">
            {channel === 'email' ? 'Works if a valid email is saved on your account.' : ''}
          </div>
        </div>
      ) : null}

      <CButton type="submit" className="portal-primary-btn mt-3" disabled={submitting || !phoneValid}>
        {submitting ? (
          <>
            <CSpinner size="sm" className="me-2" aria-hidden="true" />
            Sending…
          </>
        ) : (
          'Send code'
        )}
      </CButton>
      <p className="portal-trust">
        🔒 We&apos;ll never share your details. Codes expire in {ttlMinutes} minutes.
      </p>
    </CForm>
  )

  const renderDeviceStep = () => (
    <CForm key="device" onSubmit={handleDeviceCheck}>
      <h1 className="portal-heading">Confirm it&apos;s you</h1>
      <p className="portal-subtext">
        This looks like a new device. For your security, enter the last 4 characters of the ID number
        registered on your account.
      </p>
      {errorAlert}
      <CInputGroup className="mb-4">
        <CInputGroupText className="portal-phone-prefix">
          <CIcon icon={cilLockLocked} />
        </CInputGroupText>
        <CFormInput
          type="text"
          autoComplete="off"
          placeholder="Last 4 characters of ID number"
          aria-label="Last 4 characters of ID number"
          value={idLast4}
          onChange={(e) => setIdLast4(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
          maxLength={4}
          autoFocus
          required
        />
      </CInputGroup>
      <CButton type="submit" className="portal-primary-btn" disabled={submitting || idLast4.length !== 4}>
        {submitting ? (
          <>
            <CSpinner size="sm" className="me-2" aria-hidden="true" />
            Checking…
          </>
        ) : (
          'Confirm & sign in'
        )}
      </CButton>
      <div className="portal-linkrow">
        <button type="button" className="portal-link" onClick={startOver} disabled={submitting}>
          Cancel
        </button>
      </div>
    </CForm>
  )

  const renderVerifyStep = () => {
    const number = formatInternational(local)
    const article = codeLength === 8 ? 'an' : 'a'
    const sentTo =
      challenge.channel === 'email'
        ? `We sent ${article} ${codeLength}-digit code to the email saved on the account for ${number}.`
        : `We sent ${article} ${codeLength}-digit code by ${channelLabel(challenge.channel)} to ${number}.`
    return (
      <CForm key="verify" onSubmit={handleVerify}>
        <h1 className="portal-heading">Enter your code</h1>
        <p className="portal-subtext" aria-live="polite">
          {sentTo}
        </p>
        {errorAlert}
        <OtpCodeInput key={codeKey} value={code} onChange={handleCodeChange} length={codeLength} disabled={submitting} autoFocus />
        <CButton
          type="submit"
          className="portal-primary-btn mt-4"
          disabled={submitting || code.length !== codeLength}
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
          <button type="button" className="portal-link" onClick={startOver} disabled={submitting}>
            Wrong number?
          </button>
          <span className="portal-linkrow-end">
            {resendIn > 0 ? (
              <span className="portal-help m-0" aria-live="off">
                Resend in {formatCountdown(resendIn)}
              </span>
            ) : (
              <>
                <button
                  type="button"
                  className="portal-link"
                  onClick={() => sendCode(challenge.channel)}
                  disabled={submitting}
                >
                  Resend code
                </button>
                {challenge.channel !== 'email' ? (
                  <button
                    type="button"
                    className="portal-link ms-3"
                    onClick={() => {
                      setChannel(retryWithOther)
                      startOver()
                    }}
                    disabled={submitting}
                  >
                    Try {channelLabel(retryWithOther)} instead
                  </button>
                ) : null}
              </>
            )}
          </span>
        </div>
      </CForm>
    )
  }

  return (
    <div className="login-page-bg portal-login min-vh-100 d-flex flex-row align-items-center">
      <CContainer className="px-3">
        <CRow className="justify-content-center">
          <CCol md={10} lg={8}>
            <CCardGroup className="d-flex portal-card-group">
              <CCard className="portal-form-panel" data-coreui-theme="dark">
                <CCardBody>
                  {/* Distinct keys so switching steps mounts fresh DOM. Otherwise React reuses the
                      clicked <button> (e.g. "Wrong number?") as the other step's submit
                      button mid-click, and the browser's default action then submits that form. */}
                  {!challenge ? renderRequestStep() : deviceCheck ? renderDeviceStep() : renderVerifyStep()}
                  <p className="portal-footer-link">
                    Are you staff? <Link to="/login">Staff sign in</Link>
                  </p>
                </CCardBody>
              </CCard>
              <CCard className="portal-brand-panel">
                <CCardBody className="d-flex flex-column justify-content-center">
                  <img src={arislmsLogo} alt="ARIS LMS Logo" className="portal-brand-logo" />
                  <ul className="portal-benefits">
                    {BENEFITS.map((b) => (
                      <li key={b.text}>
                        <span className="portal-benefit-icon" aria-hidden="true">
                          <CIcon icon={b.icon} />
                        </span>
                        <span>{b.text}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="small text-center">
                    <Link to="/">Back to home</Link>
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
