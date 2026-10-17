/**
 * Client portal dashboard: current loan at a glance, the next instalment,
 * credit score gauge, and recent payments, with shortcuts to apply / report
 * a payment.
 *
 * @component
 */

import React, { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CProgress,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCalendar, cilMoney, cilPlus, cilTask, cilWallet } from '@coreui/icons'

import KpiCard from '../../components/KpiCard'
import StatusBadge from '../../components/StatusBadge'
import CreditScoreGauge from '../../components/CreditScoreGauge'
import PaymentsTable from '../../components/loans/PaymentsTable'
import { usePortalDashboard, usePortalDocuments, usePortalMe } from '../../hooks/usePortal'
import { useClientAuth } from '../../context/ClientAuthContext'
import { DOCUMENT_TYPE, LOAN_STATUS } from '../../constants/enums'
import { formatCurrency, formatDate } from '../../utils/format'

const REPAYABLE = ['disbursed', 'active', 'partially_paid', 'overdue']
const IN_REVIEW = ['pending', 'in_review', 'under_review', 'approved']

// Shown once per browser session so returning to the dashboard doesn't nag.
const REVERIFY_PROMPT_KEY = 'aris_portal_reverify_prompted'

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/** Pop up once when staff have asked the client to re-verify, then steer them to Profile. */
const useReverificationPrompt = (navigate) => {
  const { data: me } = usePortalMe()
  const pending = me?.status === 'pending_kyc_reverification'
  const { data: docs, isSuccess: docsLoaded } = usePortalDocuments({ enabled: pending })

  useEffect(() => {
    const promptKey = `${REVERIFY_PROMPT_KEY}:${me?.id}`
    if (!pending || !docsLoaded || sessionStorage.getItem(promptKey)) return
    sessionStorage.setItem(promptKey, '1')

    const flagged = (docs?.documents || []).filter((d) => d.verificationStatus === 'pending_reverification')
    const missing = (docs?.uploadableTypes || []).filter((t) => !(docs?.documents || []).some((d) => d.documentType === t))
    const items = [
      ...flagged.map((d) => `<li><strong>${escapeHtml(DOCUMENT_TYPE.labels[d.documentType] || d.documentType)}</strong>${
        d.verificationNotes ? ` &mdash; <em>${escapeHtml(d.verificationNotes)}</em>` : ''}</li>`),
      ...missing.map((t) => `<li><strong>${escapeHtml(DOCUMENT_TYPE.labels[t] || t)}</strong> &mdash; <em>not yet provided</em></li>`),
    ]

    Swal.fire({
      icon: 'warning',
      title: 'We need to re-verify your identity',
      html: [
        me.kycNotes ? `<p style="margin:0 0 10px"><em>${escapeHtml(me.kycNotes)}</em></p>` : '',
        items.length
          ? `<p style="margin:0 0 4px">Please upload:</p><ul style="text-align:left;margin:0;padding-left:20px">${items.join('')}</ul>`
          : '<p style="margin:0">Please review your identity documents on your profile.</p>',
      ].join(''),
      showCancelButton: true,
      confirmButtonText: 'Go to my profile',
      cancelButtonText: 'Later',
      reverseButtons: true,
    }).then(({ isConfirmed }) => {
      if (isConfirmed) navigate('/portal/profile')
    })
  }, [pending, docsLoaded, docs, me, navigate])
}

const PortalDashboard = () => {
  const navigate = useNavigate()
  const { client } = useClientAuth()
  const { data, isLoading, error } = usePortalDashboard()
  useReverificationPrompt(navigate)

  if (isLoading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )
  }
  if (error) return <CAlert color="danger">{error.message || 'Could not load your dashboard.'}</CAlert>

  const loan = data?.currentLoan
  const next = data?.nextInstallment
  const score = data?.creditScore
  const isRepayable = loan && REPAYABLE.includes(loan.status)
  const repaidPct = loan && Number(loan.principalAmount) > 0
    ? Math.min(100, Math.round((Number(loan.amountRepaid || 0) / Number(loan.principalAmount)) * 100))
    : 0

  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-4">
        <div>
          <h1 className="h4 mb-0">Welcome back{client?.firstName ? `, ${client.firstName}` : ''}</h1>
          <div className="text-body-secondary small">Here is where your account stands today.</div>
        </div>
        <div className="ms-md-auto d-flex gap-2">
          {isRepayable ? (
            <Link to="/portal/report-payment">
              <CButton color="primary"><CIcon icon={cilTask} className="me-1" />Report a payment</CButton>
            </Link>
          ) : null}
          {!loan ? (
            <Link to="/portal/apply">
              <CButton color="primary"><CIcon icon={cilPlus} className="me-1" />Apply for a loan</CButton>
            </Link>
          ) : null}
        </div>
      </div>

      {loan?.status === 'overdue' || next?.status === 'overdue' ? (
        <CAlert color="danger">
          You have an overdue instalment. Please make a payment as soon as possible to avoid further penalties.
        </CAlert>
      ) : null}

      <CRow className="g-3 mb-4">
        <CCol xs={12} sm={6} xl={4}>
          <KpiCard
            title="Outstanding balance"
            value={loan ? formatCurrency(loan.totalOutstandingBalance ?? loan.outstandingBalance, loan.currency) : '—'}
            sub={loan ? `Loan ${loan.referenceCode}` : 'No active loan'}
            color="primary"
            icon={cilMoney}
          />
        </CCol>
        <CCol xs={12} sm={6} xl={4}>
          <KpiCard
            title="Next instalment"
            value={next ? formatCurrency(next.amountDue, loan?.currency) : '—'}
            sub={next ? `Due ${formatDate(next.dueDate)}${next.status === 'overdue' ? ' · overdue' : ''}` : 'Nothing due'}
            color={next?.status === 'overdue' ? 'danger' : 'info'}
            icon={cilCalendar}
          />
        </CCol>
        <CCol xs={12} sm={12} xl={4}>
          <KpiCard
            title="Credit limit"
            value={score?.creditLimit != null ? formatCurrency(score.creditLimit) : '—'}
            sub={`${data?.stats?.closedLoans ?? 0} loan(s) fully repaid`}
            color="success"
            icon={cilWallet}
          />
        </CCol>
      </CRow>

      <CRow className="g-3">
        <CCol lg={7}>
          <CCard className="h-100">
            <CCardHeader><strong>Current loan</strong></CCardHeader>
            <CCardBody>
              {loan ? (
                <>
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                    <div>
                      <div className="fw-semibold">{loan.productName || 'Loan'} · {loan.referenceCode}</div>
                      <div className="small text-body-secondary">
                        {formatCurrency(loan.principalAmount, loan.currency)} over {loan.termMonths} month{loan.termMonths === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div className="ms-auto"><StatusBadge enumDef={LOAN_STATUS} value={loan.status} /></div>
                  </div>
                  {isRepayable ? (
                    <>
                      <div className="d-flex justify-content-between small mb-1">
                        <span>Repaid {formatCurrency(loan.amountRepaid || 0, loan.currency)}</span>
                        <span className="text-body-secondary">{repaidPct}% of principal</span>
                      </div>
                      <CProgress
                        value={repaidPct}
                        color="success"
                        className="mb-3"
                        aria-label={`Repaid ${repaidPct}% of principal`}
                      />
                    </>
                  ) : IN_REVIEW.includes(loan.status) ? (
                    <p className="text-body-secondary small">
                      Your application is being reviewed. We&apos;ll notify you by SMS or email when there is a decision.
                    </p>
                  ) : null}
                  <CButton color="secondary" variant="outline" size="sm" onClick={() => navigate(`/portal/loans/${loan.id}`)}>
                    View loan details
                  </CButton>
                </>
              ) : (
                <div className="text-body-secondary">
                  You don&apos;t have an active loan. <Link to="/portal/apply">Apply for one</Link> in a few minutes.
                </div>
              )}
            </CCardBody>
          </CCard>
        </CCol>
        <CCol lg={5}>
          <CCard className="h-100">
            <CCardHeader><strong>Credit score</strong></CCardHeader>
            <CCardBody>
              <CreditScoreGauge
                score={score?.riskScore}
                grade={score?.riskGrade}
                creditLimit={score?.creditLimit}
                scoredAt={score?.createdAt}
              />
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={12}>
          <CCard>
            <CCardHeader className="d-flex align-items-center">
              <strong>Recent payments</strong>
              <Link to="/portal/payments" className="ms-auto small">View all</Link>
            </CCardHeader>
            <CCardBody>
              <PaymentsTable payments={data?.recentPayments ?? []} emptyMessage="No payments yet." />
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  )
}

export default PortalDashboard
