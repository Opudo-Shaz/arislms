/**
 * Public co-signer consent page (`/co-signer/consent/:token`), opened from the
 * SMS/email link sent to a nominated co-signer. No sign-in: the link token
 * identifies the request, and a one-time code sent to the co-signer's own
 * phone/email proves it's them before their accept/decline is recorded.
 *
 * @component
 */

import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCheckCircle, cilWarning, cilXCircle } from '@coreui/icons'

import arislmsLogoDefault from '../../assets/brand/arislms_logo_fit.png'
import arislmsLogoDark from '../../assets/brand/arislms_logo_dark.png'
import portalApi from '../../api/portalApi'
import { formatCurrency, formatDateTime } from '../../utils/format'

const CLOSED_MESSAGES = {
  accepted: { color: 'success', icon: cilCheckCircle, text: 'You have already agreed to co-sign this loan. Thank you.' },
  declined: { color: 'secondary', icon: cilXCircle, text: 'You declined to co-sign this loan. No further action is needed.' },
  expired: { color: 'secondary', icon: cilWarning, text: 'This request has expired. If you still want to co-sign, ask the borrower to send a new request.' },
  superseded: { color: 'secondary', icon: cilWarning, text: 'This request has been replaced. If you received a newer link, please use that one.' },
}

const CoSignerConsent = () => {
  const { token } = useParams()

  // Light logo on dark backgrounds and vice versa (same approach as AcceptInvite).
  const [colorScheme, setColorScheme] = useState(
    document.documentElement.getAttribute('data-coreui-theme') || 'light',
  )
  useEffect(() => {
    const handleColorSchemeChange = () => {
      setColorScheme(document.documentElement.getAttribute('data-coreui-theme') || 'light')
    }
    document.documentElement.addEventListener('ColorSchemeChange', handleColorSchemeChange)
    return () =>
      document.documentElement.removeEventListener('ColorSchemeChange', handleColorSchemeChange)
  }, [])
  const arislmsLogo = colorScheme === 'dark' ? arislmsLogoDefault : arislmsLogoDark
  const [view, setView] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [decision, setDecision] = useState(null) // 'accept' | 'decline'
  const [reason, setReason] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [channel, setChannel] = useState('sms')
  const [codeSentTo, setCodeSentTo] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  useEffect(() => {
    let cancelled = false
    portalApi
      .getCoSignerConsent(token)
      .then((data) => {
        if (cancelled) return
        setView(data)
        if (!data?.otpDestinations?.sms && data?.otpDestinations?.email) setChannel('email')
      })
      .catch((err) => !cancelled && setLoadError(err?.message || 'This link is invalid.'))
    return () => {
      cancelled = true
    }
  }, [token])

  const sendCode = async () => {
    setError('')
    setBusy(true)
    try {
      const res = await portalApi.sendCoSignerConsentOtp(token, channel)
      setCodeSentTo(res.sentTo)
    } catch (err) {
      setError(err?.message || 'Could not send a code.')
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    setError('')
    setBusy(true)
    try {
      const res = await portalApi.respondToCoSignerConsent(token, {
        decision,
        code,
        ...(decision === 'decline' && reason.trim() ? { reason: reason.trim() } : {}),
      })
      setDone(res)
    } catch (err) {
      const fieldErrors = err?.data?.errors
      setError(fieldErrors?.length ? fieldErrors.map((f) => f.message).join(' ') : err?.message || 'Could not record your response.')
    } finally {
      setBusy(false)
    }
  }

  const loan = view?.loan
  const closed = view && view.status !== 'pending' ? CLOSED_MESSAGES[view.status] : null

  let body
  if (loadError) {
    body = <CAlert color="warning" className="mb-0">{loadError}</CAlert>
  } else if (!view) {
    body = <div className="text-center py-4"><CSpinner color="primary" /></div>
  } else if (done) {
    const accepted = done.data?.status === 'accepted'
    body = (
      <CAlert color={accepted ? 'success' : 'secondary'} className="d-flex gap-2 mb-0">
        <CIcon icon={accepted ? cilCheckCircle : cilXCircle} className="flex-shrink-0 mt-1" />
        <div>{done.message}</div>
      </CAlert>
    )
  } else if (closed) {
    body = (
      <CAlert color={closed.color} className="d-flex gap-2 mb-0">
        <CIcon icon={closed.icon} className="flex-shrink-0 mt-1" />
        <div>{closed.text}</div>
      </CAlert>
    )
  } else {
    body = (
      <>
        <p>
          Hi {view.coSignerFirstName}, <strong>{view.borrowerName}</strong> has named you as co-signer (guarantor)
          for the loan below.
        </p>
        {loan ? (
          <dl className="row border rounded py-2 mx-0 mb-3">
            <dt className="col-5 text-body-secondary fw-normal">Loan</dt>
            <dd className="col-7 mb-1">{loan.productName || 'Loan'} · {loan.referenceCode}</dd>
            <dt className="col-5 text-body-secondary fw-normal">Amount</dt>
            <dd className="col-7 mb-1">{formatCurrency(loan.principalAmount, loan.currency)}</dd>
            <dt className="col-5 text-body-secondary fw-normal">Term</dt>
            <dd className="col-7 mb-1">{loan.termMonths} month{loan.termMonths === 1 ? '' : 's'}</dd>
            <dt className="col-5 text-body-secondary fw-normal">Instalment</dt>
            <dd className="col-7 mb-1">{formatCurrency(loan.installmentAmount, loan.currency)}</dd>
            <dt className="col-5 text-body-secondary fw-normal">Interest</dt>
            <dd className="col-7 mb-0">
              {Number(loan.interestRate)}% {loan.interestRatePeriod === 'monthly' ? 'per month' : 'per year'}
            </dd>
          </dl>
        ) : null}
        <CAlert color="warning" className="small">
          As co-signer you agree that, if the borrower does not repay, you may be asked to repay the outstanding amount.
          Only accept if you know the borrower and are willing to take on this responsibility. If you don&apos;t
          recognise this request, decline it.
        </CAlert>
        <div className="small text-body-secondary mb-3">This request expires {formatDateTime(view.expiresAt)}.</div>

        {error ? <CAlert color="danger" className="py-2" dismissible onClose={() => setError('')}>{error}</CAlert> : null}

        {!decision ? (
          <div className="d-flex flex-wrap gap-2">
            <CButton color="success" onClick={() => setDecision('accept')}>I agree to co-sign</CButton>
            <CButton color="danger" variant="outline" onClick={() => setDecision('decline')}>Decline</CButton>
          </div>
        ) : (
          <>
            {decision === 'accept' ? (
              <CFormCheck
                id="cs-agree"
                className="mb-3"
                label={`I understand I may be liable to repay ${loan ? formatCurrency(loan.principalAmount, loan.currency) : 'this loan'} plus interest if ${view.borrowerName} does not.`}
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
            ) : (
              <div className="mb-3">
                <CFormLabel htmlFor="cs-reason">Reason (optional — shared with the borrower)</CFormLabel>
                <CFormTextarea id="cs-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            )}

            {!codeSentTo ? (
              <>
                <div className="small mb-2">To confirm it&apos;s you, we&apos;ll send a one-time code to your registered contact:</div>
                <div className="d-flex flex-wrap gap-3 mb-3">
                  {view.otpDestinations?.sms ? (
                    <CFormCheck type="radio" name="cs-channel" id="cs-sms" label={`SMS to ${view.otpDestinations.sms}`}
                      checked={channel === 'sms'} onChange={() => setChannel('sms')} />
                  ) : null}
                  {view.otpDestinations?.email ? (
                    <CFormCheck type="radio" name="cs-channel" id="cs-email" label={`Email to ${view.otpDestinations.email}`}
                      checked={channel === 'email'} onChange={() => setChannel('email')} />
                  ) : null}
                </div>
                <div className="d-flex flex-wrap gap-2">
                  <CButton color="primary" onClick={sendCode} disabled={busy || (decision === 'accept' && !agreed)}>
                    {busy ? <CSpinner size="sm" /> : 'Send code'}
                  </CButton>
                  <CButton color="secondary" variant="ghost" onClick={() => { setDecision(null); setAgreed(false) }} disabled={busy}>
                    Back
                  </CButton>
                </div>
              </>
            ) : (
              <>
                <CFormLabel htmlFor="cs-code">Enter the code sent to {codeSentTo}</CFormLabel>
                <CFormInput
                  id="cs-code"
                  className="mb-3"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={10}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                />
                <div className="d-flex flex-wrap gap-2">
                  <CButton
                    color={decision === 'accept' ? 'success' : 'danger'}
                    onClick={submit}
                    disabled={busy || code.length < 4}
                  >
                    {busy ? <CSpinner size="sm" /> : decision === 'accept' ? 'Confirm — I agree to co-sign' : 'Confirm decline'}
                  </CButton>
                  <CButton color="link" className="px-0" onClick={sendCode} disabled={busy}>Resend code</CButton>
                </div>
              </>
            )}
          </>
        )}
      </>
    )
  }

  return (
    <div className="login-page-bg min-vh-100 d-flex flex-row align-items-center py-4">
      <CContainer className="px-3">
        <CRow className="justify-content-center">
          <CCol md={8} lg={6}>
            <div className="text-center mb-3">
              <img src={arislmsLogo} alt="ARIS LMS" style={{ height: 48, width: 'auto' }} />
            </div>
            <CCard>
              <CCardBody className="p-4">
                <h1 className="h4 mb-3">Co-signer request</h1>
                {body}
              </CCardBody>
            </CCard>
            <div className="text-center small mt-3">
              <Link to="/">ARIS LMS home</Link>
            </div>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default CoSignerConsent
