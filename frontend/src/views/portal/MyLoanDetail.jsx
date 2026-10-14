/**
 * Client portal: one of the client's loans — overview, repayment schedule,
 * and payments. The API returns 404 for loans that aren't the client's.
 *
 * @component
 */

import React, { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CSpinner,
  CTabContent,
  CTabPane,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilTask } from '@coreui/icons'

import StatusBadge from '../../components/StatusBadge'
import CoSignerPicker from '../../components/portal/CoSignerPicker'
import ScheduleTable from '../../components/loans/ScheduleTable'
import PaymentsTable from '../../components/loans/PaymentsTable'
import { usePortalLoan, usePortalLoanPayments, useRenominateCoSigner } from '../../hooks/usePortal'
import { CO_SIGNER_CONSENT_STATUS, LOAN_STATUS } from '../../constants/enums'
import toast from '../../utils/toast'
import { formatCurrency, formatDate } from '../../utils/format'

const REPAYABLE = ['disbursed', 'active', 'partially_paid', 'overdue']

const Field = ({ label, children }) => (
  <CCol xs={6} md={4} className="mb-3">
    <div className="text-body-secondary small">{label}</div>
    <div>{children ?? '—'}</div>
  </CCol>
)

const TABS = ['Overview', 'Schedule', 'Payments']
const AWAITING_DECISION = ['pending', 'in_review', 'under_review']

/** Co-signer status, plus a way to nominate someone else after a decline/expiry. */
const CoSignerSection = ({ loan }) => {
  const renominate = useRenominateCoSigner(loan.id)
  const [pick, setPick] = useState(null)
  const [error, setError] = useState('')
  const status = loan.coSignerConsentStatus
  const canRenominate = AWAITING_DECISION.includes(loan.status) && ['declined', 'expired'].includes(status)

  const submit = async () => {
    setError('')
    try {
      await renominate.mutateAsync(pick.coSignerToken)
      setPick(null)
      toast.success('Your new co-signer has been sent a link to consent.')
    } catch (err) {
      setError(err?.message || 'Could not update your co-signer.')
    }
  }

  return (
    <div className="border rounded p-3 mb-3">
      <div className="d-flex flex-wrap align-items-center gap-2">
        <div>
          <div className="small text-body-secondary">Co-signer</div>
          <div className="fw-semibold">{loan.coSigner?.displayName || '—'}</div>
        </div>
        {status ? <StatusBadge enumDef={CO_SIGNER_CONSENT_STATUS} value={status} /> : null}
      </div>
      {status === 'pending' ? (
        <div className="small text-body-secondary mt-2">
          We sent them a link by SMS/email. Your loan can be approved once they consent.
        </div>
      ) : null}
      {canRenominate ? (
        <div className="mt-3">
          <CAlert color={status === 'declined' ? 'warning' : 'secondary'} className="py-2 small">
            {status === 'declined'
              ? 'Your co-signer declined. Nominate someone else to continue with this application.'
              : 'The consent link expired before your co-signer responded. Nominate them again or choose someone else.'}
          </CAlert>
          {error ? <CAlert color="danger" className="py-2 small">{error}</CAlert> : null}
          <CoSignerPicker value={pick} onChange={setPick} id="renominate-cosigner" disabled={renominate.isPending} />
          {pick ? (
            <CButton color="primary" size="sm" className="mt-2" onClick={submit} disabled={renominate.isPending}>
              {renominate.isPending ? <CSpinner size="sm" /> : 'Send consent request'}
            </CButton>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

const MyLoanDetail = () => {
  const { id } = useParams()
  const [tab, setTab] = useState(0)
  const { data: loan, isLoading, error } = usePortalLoan(id)
  const { data: payments = [], isLoading: paymentsLoading } = usePortalLoanPayments(id)

  if (isLoading) return <div className="text-center py-5"><CSpinner color="primary" /></div>
  if (error || !loan) {
    return (
      <CAlert color={error?.status === 404 ? 'warning' : 'danger'}>
        {error?.status === 404 ? 'Loan not found.' : error?.message || 'Could not load this loan.'}{' '}
        <Link to="/portal/loans">Back to my loans</Link>
      </CAlert>
    )
  }

  const ratePeriod = loan.interestRatePeriod === 'monthly' ? 'per month' : 'per year'

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex flex-wrap align-items-center gap-2">
        <div>
          <strong>{loan.referenceCode}</strong>
          <span className="text-body-secondary ms-2 small">{loan.productName}</span>
        </div>
        <StatusBadge enumDef={LOAN_STATUS} value={loan.status} />
        {REPAYABLE.includes(loan.status) ? (
          <Link to="/portal/report-payment" className="ms-auto">
            <CButton color="primary" size="sm"><CIcon icon={cilTask} className="me-1" />Report a payment</CButton>
          </Link>
        ) : null}
      </CCardHeader>
      <CCardBody>
        <CNav variant="tabs" role="tablist" className="mb-3">
          {TABS.map((label, i) => (
            <CNavItem key={label}>
              <CNavLink as="button" type="button" active={tab === i} onClick={() => setTab(i)}>
                {label}
              </CNavLink>
            </CNavItem>
          ))}
        </CNav>
        <CTabContent>
          <CTabPane visible={tab === 0}>
            {loan.coSigner ? <CoSignerSection loan={loan} /> : null}
            <CRow>
              <Field label="Principal">{formatCurrency(loan.principalAmount, loan.currency)}</Field>
              <Field label="Outstanding (incl. interest)">
                {formatCurrency(loan.totalOutstandingBalance ?? loan.outstandingBalance, loan.currency)}
              </Field>
              <Field label="Repaid">{formatCurrency(loan.amountRepaid || 0, loan.currency)}</Field>
              <Field label="Interest">{`${Number(loan.interestRate)}% ${ratePeriod}`}</Field>
              <Field label="Term">{loan.termMonths} month{loan.termMonths === 1 ? '' : 's'}</Field>
              <Field label="Instalment">{formatCurrency(loan.installmentAmount, loan.currency)}</Field>
              <Field label="Start date">{formatDate(loan.startDate)}</Field>
              <Field label="End date">{formatDate(loan.endDate)}</Field>
              <Field label="Next payment">{formatDate(loan.nextPaymentDate)}</Field>
              {Number(loan.downPaymentRequired) > 0 ? (
                <Field label="Down payment">
                  {formatCurrency(loan.downPaymentPaid || 0, loan.currency)} of {formatCurrency(loan.downPaymentRequired, loan.currency)}
                </Field>
              ) : null}
              {Number(loan.penalties) > 0 ? (
                <Field label="Penalties">
                  <span className="text-danger">{formatCurrency(loan.penalties, loan.currency)}</span>
                </Field>
              ) : null}
              <Field label="Applied">{formatDate(loan.createdAt)}</Field>
            </CRow>
          </CTabPane>
          <CTabPane visible={tab === 1}>
            <ScheduleTable
              schedules={[...(loan.repaymentSchedules || [])].sort((a, b) => a.installmentNumber - b.installmentNumber)}
              currency={loan.currency}
            />
          </CTabPane>
          <CTabPane visible={tab === 2}>
            <PaymentsTable payments={payments} currency={loan.currency} loading={paymentsLoading} />
          </CTabPane>
        </CTabContent>
      </CCardBody>
    </CCard>
  )
}

export default MyLoanDetail
