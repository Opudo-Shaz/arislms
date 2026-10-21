/**
 * Client portal: apply for a loan.
 *
 * The request runs through the same credit-scoring pipeline as staff-created
 * applications. Whatever the score, the request is queued for approval and
 * approvers are notified; if the score is below the auto-approval threshold
 * the client is told so and pointed to support. Eligibility problems (KYC,
 * an open loan) are shown up front instead of the form.
 *
 * @component
 */

import React, { useMemo, useState } from 'react'
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
  CFormSelect,
  CFormTextarea,
  CInputGroup,
  CInputGroupText,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCheckCircle, cilWarning } from '@coreui/icons'

import CreditScoreGauge from '../../components/CreditScoreGauge'
import CoSignerPicker from '../../components/portal/CoSignerPicker'
import { usePortalDashboard, usePortalMe, usePublicLoanProducts, useSubmitLoanRequest } from '../../hooks/usePortal'
import { formatCurrency, formatTermRange, termOptions } from '../../utils/format'

// Mirrors loanService.validateClientOpenLoans — one open loan at a time.
const OPEN_STATUSES = ['approved', 'disbursed', 'in_review', 'active', 'under_review', 'pending']

const LoanRequestForm = () => {
  const { data: me, isLoading: meLoading } = usePortalMe()
  const { data: dashboard, isLoading: dashLoading } = usePortalDashboard()
  const { data: products = [], isLoading: productsLoading } = usePublicLoanProducts()
  const submit = useSubmitLoanRequest()

  const [productId, setProductId] = useState('')
  const [amount, setAmount] = useState('')
  const [termMonths, setTermMonths] = useState('')
  const [notes, setNotes] = useState('')
  const [coSigner, setCoSigner] = useState(null)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const selfService = useMemo(() => products.filter((p) => p.selfServiceAvailable), [products])
  const branchOnly = useMemo(() => products.filter((p) => !p.selfServiceAvailable), [products])
  const product = selfService.find((p) => String(p.id) === String(productId))
  const creditLimit = dashboard?.creditScore?.creditLimit

  if (meLoading || dashLoading || productsLoading) {
    return <div className="text-center py-5"><CSpinner color="primary" /></div>
  }

  if (result) {
    const { message, data } = result
    return (
      <CCard className="mb-4">
        <CCardHeader><strong>Loan request submitted</strong></CCardHeader>
        <CCardBody>
          <CAlert color={data.scorePassed ? 'success' : 'warning'} className="d-flex gap-2">
            <CIcon icon={data.scorePassed ? cilCheckCircle : cilWarning} className="flex-shrink-0 mt-1" />
            <div>{message}</div>
          </CAlert>
          <CRow className="g-3 align-items-center">
            <CCol md={6}>
              <dl className="row mb-0">
                <dt className="col-5 text-body-secondary fw-normal">Reference</dt>
                <dd className="col-7">{data.loan.referenceCode}</dd>
                <dt className="col-5 text-body-secondary fw-normal">Amount</dt>
                <dd className="col-7">{formatCurrency(data.loan.principalAmount, data.loan.currency)}</dd>
                <dt className="col-5 text-body-secondary fw-normal">Term</dt>
                <dd className="col-7">{data.loan.termMonths} months</dd>
                <dt className="col-5 text-body-secondary fw-normal">Instalment</dt>
                <dd className="col-7">{formatCurrency(data.loan.installmentAmount, data.loan.currency)}</dd>
                {data.loan.coSigner ? (
                  <>
                    <dt className="col-5 text-body-secondary fw-normal">Co-signer</dt>
                    <dd className="col-7">{data.loan.coSigner.displayName} · awaiting their consent</dd>
                  </>
                ) : null}
              </dl>
            </CCol>
            <CCol md={6}>
              <CreditScoreGauge score={data.riskScore} grade={data.riskGrade} creditLimit={data.creditLimit} compact />
            </CCol>
          </CRow>
          <div className="d-flex gap-2 mt-4">
            <Link to={`/portal/loans/${data.loan.id}`}><CButton color="primary">View request</CButton></Link>
            <Link to="/portal/dashboard"><CButton color="secondary" variant="outline">Back to dashboard</CButton></Link>
          </div>
        </CCardBody>
      </CCard>
    )
  }

  const openLoan = dashboard?.currentLoan && OPEN_STATUSES.includes(dashboard.currentLoan.status)
    ? dashboard.currentLoan
    : null
  const blocker = me?.kycStatus !== 'verified'
    ? 'Your identity verification (KYC) is not complete yet. Please contact support or visit a branch to finish it, then come back to apply.'
    : openLoan
      ? `You already have a loan (${openLoan.referenceCode}) that is open or awaiting a decision. You can apply again once it is closed.`
      : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const res = await submit.mutateAsync({
        loanProductId: Number(productId),
        principalAmount: Number(amount),
        termMonths: Number(termMonths),
        ...(product?.requiresCoSigner && coSigner ? { coSignerToken: coSigner.coSignerToken } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      })
      setResult(res)
    } catch (err) {
      const fieldErrors = err?.data?.errors
      setError(fieldErrors?.length ? fieldErrors.map((f) => f.message).join(' ') : err?.message || 'Could not submit your request.')
    }
  }

  const amountNum = Number(amount)
  const amountHint = product
    ? `Between ${formatCurrency(product.minLoanAmount, product.currency)} and ${formatCurrency(
        creditLimit != null ? Math.min(Number(product.maxLoanAmount), Number(creditLimit)) : product.maxLoanAmount,
        product.currency,
      )}${creditLimit != null && Number(creditLimit) < Number(product.maxLoanAmount) ? ' (your current credit limit)' : ''}.`
    : null

  return (
    <CCard className="mb-4">
      <CCardHeader><strong>Apply for a loan</strong></CCardHeader>
      <CCardBody>
        {blocker ? (
          <CAlert color="info" className="mb-0">
            {blocker} <Link to="/portal/dashboard">Back to dashboard</Link>
          </CAlert>
        ) : (
          <CForm onSubmit={handleSubmit}>
            {error ? <CAlert color="danger" dismissible onClose={() => setError(null)}>{error}</CAlert> : null}
            <CRow className="g-3">
              <CCol md={6}>
                <CFormLabel htmlFor="lr-product">Loan product</CFormLabel>
                <CFormSelect
                  id="lr-product"
                  value={productId}
                  onChange={(e) => { setProductId(e.target.value); setTermMonths('') }}
                  required
                >
                  <option value="">Select a product…</option>
                  {selfService.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.requiresCoSigner ? ' (co-signer required)' : ''}</option>
                  ))}
                </CFormSelect>
                {branchOnly.length ? (
                  <div className="form-text">
                    Products that need collateral aren&apos;t listed here — apply for those at a branch.
                  </div>
                ) : null}
              </CCol>
              <CCol md={6}>
                <CFormLabel htmlFor="lr-amount">Amount</CFormLabel>
                <CInputGroup>
                  <CInputGroupText>{product?.currency || 'KES'}</CInputGroupText>
                  <CFormInput
                    id="lr-amount"
                    type="number"
                    inputMode="decimal"
                    min={product?.minLoanAmount || 1}
                    max={product?.maxLoanAmount || undefined}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={!product}
                    required
                  />
                </CInputGroup>
                {amountHint ? <div className="form-text">{amountHint}</div> : null}
                {creditLimit != null && amountNum > Number(creditLimit) ? (
                  <div className="small text-danger mt-1">This is above your credit limit of {formatCurrency(creditLimit)}.</div>
                ) : null}
              </CCol>
              <CCol md={6}>
                <CFormLabel htmlFor="lr-term">Repayment period</CFormLabel>
                <CFormSelect
                  id="lr-term"
                  value={termMonths}
                  onChange={(e) => setTermMonths(e.target.value)}
                  disabled={!product}
                  required
                >
                  <option value="">{product ? 'Select number of months…' : 'Select a product first'}</option>
                  {termOptions(product).map((m) => (
                    <option key={m} value={m}>{m} month{m === 1 ? '' : 's'}</option>
                  ))}
                </CFormSelect>
                {product ? (
                  <div className="form-text">
                    {formatTermRange(product.minRepaymentPeriodMonths, product.maxRepaymentPeriodMonths)} allowed
                    {' · '}Interest {product.interestRate}% {product.interestRatePeriod === 'monthly' ? 'per month' : 'per year'}
                    {Number(product.fees) > 0 ? ` · fees ${formatCurrency(product.fees, product.currency)}` : ''}
                    {Number(product.minimumDownPayment) > 0
                      ? ` · down payment ${product.downPaymentType === 'percentage' ? `${product.minimumDownPayment}%` : formatCurrency(product.minimumDownPayment, product.currency)}`
                      : ''}
                  </div>
                ) : null}
              </CCol>
              {product?.requiresCoSigner ? (
                <CCol md={6}>
                  <div className="small fw-semibold mb-1">Co-signer (required for {product.name})</div>
                  <CoSignerPicker value={coSigner} onChange={setCoSigner} id="lr-cosigner" />
                </CCol>
              ) : null}
              <CCol xs={12}>
                <CFormLabel htmlFor="lr-notes">What is the loan for? (optional)</CFormLabel>
                <CFormTextarea id="lr-notes" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </CCol>
            </CRow>
            <div className="d-flex flex-wrap align-items-center gap-3 mt-4">
              <CButton
                color="primary"
                type="submit"
                disabled={submit.isPending || !product || !amount || !termMonths || (product.requiresCoSigner && !coSigner)}
              >
                {submit.isPending ? <CSpinner size="sm" /> : 'Submit request'}
              </CButton>
              <span className="small text-body-secondary">
                Your credit score is re-assessed when you submit. Every request is reviewed by our team.
              </span>
            </div>
          </CForm>
        )}
      </CCardBody>
    </CCard>
  )
}

export default LoanRequestForm
