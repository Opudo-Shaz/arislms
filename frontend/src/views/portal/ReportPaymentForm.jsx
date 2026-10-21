/**
 * Client portal: report a repayment made manually (e.g. via M-Pesa paybill).
 * Temporary until direct M-Pesa integration. The report is attached to the
 * client's current loan automatically; staff confirm it against the
 * statement (and can correct details) before it is applied.
 *
 * @component
 */

import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CInputGroup,
  CInputGroupText,
  CRow,
  CSpinner,
} from '@coreui/react'
import FormSelect from '../../components/FormSelect'
import CIcon from '@coreui/icons-react'
import { cilCheckCircle } from '@coreui/icons'

import { usePortalDashboard, useSubmitPaymentReport } from '../../hooks/usePortal'
import { formatCurrency, formatDate } from '../../utils/format'

const REPORTABLE = ['disbursed', 'active', 'partially_paid', 'overdue']
const METHODS = [
  { value: 'MPESA', label: 'M-Pesa' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CASH', label: 'Cash (at a branch/agent)' },
  { value: 'OTHER', label: 'Other' },
]

/** Current local time as a value for <input type="datetime-local">. */
const nowLocal = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

const ReportPaymentForm = () => {
  const { data: dashboard, isLoading } = usePortalDashboard()
  const submit = useSubmitPaymentReport()

  const [form, setForm] = useState({
    amount: '',
    transactionDate: nowLocal(),
    paymentMethod: 'MPESA',
    externalRef: '',
    payerPhone: '',
    notes: '',
  })
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  if (isLoading) return <div className="text-center py-5"><CSpinner color="primary" /></div>

  const loan = dashboard?.currentLoan
  const awaitingDownPayment = loan?.status === 'approved' && Number(loan.downPaymentRequired) > Number(loan.downPaymentPaid || 0)
  const canReport = loan && (REPORTABLE.includes(loan.status) || awaitingDownPayment)
  const next = dashboard?.nextInstallment

  if (done) {
    return (
      <CCard className="mb-4">
        <CCardBody>
          <CAlert color="success" className="d-flex gap-2">
            <CIcon icon={cilCheckCircle} className="flex-shrink-0 mt-1" />
            <div>
              {done.message} We&apos;ll apply it to loan {done.data.loanReference} once it&apos;s confirmed — you can
              track it under <Link to="/portal/payments">My payments → Reported payments</Link>.
            </div>
          </CAlert>
          <div className="d-flex gap-2">
            <CButton color="primary" variant="outline" onClick={() => { setDone(null); setForm((f) => ({ ...f, amount: '', externalRef: '', notes: '' })) }}>
              Report another payment
            </CButton>
            <Link to="/portal/dashboard"><CButton color="secondary" variant="ghost">Back to dashboard</CButton></Link>
          </div>
        </CCardBody>
      </CCard>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const res = await submit.mutateAsync({
        amount: Number(form.amount),
        transactionDate: new Date(form.transactionDate).toISOString(),
        paymentMethod: form.paymentMethod,
        externalRef: form.externalRef.trim(),
        ...(form.payerPhone.trim() ? { payerPhone: form.payerPhone.replace(/[\s-]/g, '') } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      })
      setDone(res)
    } catch (err) {
      const fieldErrors = err?.data?.errors
      setError(fieldErrors?.length ? fieldErrors.map((f) => f.message).join(' ') : err?.message || 'Could not submit your report.')
    }
  }

  return (
    <CCard className="mb-4">
      <CCardHeader><strong>Report a payment</strong></CCardHeader>
      <CCardBody>
        {!canReport ? (
          <CAlert color="info" className="mb-0">
            You don&apos;t have a loan that is currently accepting repayments. <Link to="/portal/loans">View my loans</Link>
          </CAlert>
        ) : (
          <>
            <div className="border rounded p-3 mb-4 bg-body-tertiary">
              <div className="small text-body-secondary">This payment will be applied to</div>
              <div className="fw-semibold">{loan.productName || 'Loan'} · {loan.referenceCode}</div>
              <div className="small mt-1">
                Outstanding {formatCurrency(loan.totalOutstandingBalance ?? loan.outstandingBalance, loan.currency)}
                {next ? <> · next instalment {formatCurrency(next.amountDue, loan.currency)} due {formatDate(next.dueDate)}</> : null}
                {awaitingDownPayment ? (
                  <> · down payment due {formatCurrency(Number(loan.downPaymentRequired) - Number(loan.downPaymentPaid || 0), loan.currency)}</>
                ) : null}
              </div>
            </div>

            <CForm onSubmit={handleSubmit}>
              {error ? <CAlert color="danger" dismissible onClose={() => setError(null)}>{error}</CAlert> : null}
              <CRow className="g-3">
                <CCol md={6}>
                  <CFormLabel htmlFor="rp-amount">Amount paid</CFormLabel>
                  <CInputGroup>
                    <CInputGroupText>{loan.currency}</CInputGroupText>
                    <CFormInput id="rp-amount" type="number" inputMode="decimal" min="1" step="0.01" value={form.amount} onChange={set('amount')} required />
                  </CInputGroup>
                </CCol>
                <CCol md={6}>
                  <CFormLabel htmlFor="rp-date">Date &amp; time paid</CFormLabel>
                  <CFormInput id="rp-date" type="datetime-local" max={nowLocal()} value={form.transactionDate} onChange={set('transactionDate')} required />
                </CCol>
                <CCol md={6}>
                  <CFormLabel htmlFor="rp-method">Paid via</CFormLabel>
                  <FormSelect id="rp-method" value={form.paymentMethod} onChange={set('paymentMethod')}>
                    {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </FormSelect>
                </CCol>
                <CCol md={6}>
                  <CFormLabel htmlFor="rp-ref">
                    {form.paymentMethod === 'MPESA' ? 'M-Pesa transaction code' : 'Transaction reference'}
                  </CFormLabel>
                  <CFormInput
                    id="rp-ref"
                    placeholder={form.paymentMethod === 'MPESA' ? 'e.g. SJK3XY12AB' : ''}
                    value={form.externalRef}
                    onChange={(e) => setForm((f) => ({ ...f, externalRef: e.target.value.toUpperCase() }))}
                    minLength={4}
                    maxLength={128}
                    required
                  />
                  <div className="form-text">Found in your confirmation SMS. It lets us match your payment quickly.</div>
                </CCol>
                <CCol md={6}>
                  <CFormLabel htmlFor="rp-phone">Phone the payment was made from (optional)</CFormLabel>
                  <CFormInput id="rp-phone" type="tel" inputMode="tel" placeholder="2547XXXXXXXX" value={form.payerPhone} onChange={set('payerPhone')} />
                </CCol>
                <CCol xs={12}>
                  <CFormLabel htmlFor="rp-notes">Notes (optional)</CFormLabel>
                  <CFormTextarea id="rp-notes" rows={2} maxLength={1000} value={form.notes} onChange={set('notes')} />
                </CCol>
              </CRow>
              <CButton color="primary" type="submit" className="mt-4" disabled={submit.isPending}>
                {submit.isPending ? <CSpinner size="sm" /> : 'Submit report'}
              </CButton>
            </CForm>
          </>
        )}
      </CCardBody>
    </CCard>
  )
}

export default ReportPaymentForm
