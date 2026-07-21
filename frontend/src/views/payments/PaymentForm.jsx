/**
 * PaymentForm
 *
 * Modal dialog for recording a loan repayment (`POST /payments`).
 *
 * Can be opened in two ways:
 * - From the Payments list: shows a loan selector (payable loans only).
 * - From a loan detail page: pass a fixed `loan` to lock the target loan.
 *
 * The `clientId` and `currency` are derived from the selected loan, matching
 * the backend contract (currency must equal the loan currency; clientId must
 * match the loan client).
 *
 * @module views/payments/PaymentForm
 */

import React, { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'

import { useCreatePayment } from '../../hooks/usePayments'
import { useLoans } from '../../hooks/useLoans'
import { PAYMENT_METHOD } from '../../constants/enums'
import { formatCurrency } from '../../utils/format'

/** Loan statuses that can receive a repayment. */
const PAYABLE_STATUSES = ['disbursed', 'active', 'partially_paid', 'overdue']

/** Outstanding down payment on an approved (not yet disbursed) loan. */
const downPaymentDue = (l) =>
  Math.max(0, Number(((Number(l?.downPaymentRequired || 0)) - Number(l?.downPaymentPaid || 0)).toFixed(2)))

/** Approved loan still owing a down payment accepts payments as down payment. */
const requiresDownPayment = (l) => l?.status === 'approved' && downPaymentDue(l) > 0

/** A loan can receive a payment if it's in a payable state or owes a down payment. */
const isPayable = (l) => PAYABLE_STATUSES.includes(l?.status) || requiresDownPayment(l)

/** Today as YYYY-MM-DD. */
const today = () => new Date().toISOString().slice(0, 10)

const emptyForm = () => ({
  loanId: '',
  amount: '',
  paymentMethod: 'MPESA',
  transactionDate: today(),
  externalRef: '',
  payerName: '',
  payerPhone: '',
  notes: '',
})

const PaymentForm = ({ visible, loan, onClose, onSuccess }) => {
  const createMutation = useCreatePayment()
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState(null)

  const lockedLoan = Boolean(loan)

  // Loan selector data (only needed when no fixed loan is provided).
  const { data: loansResult } = useLoans({ limit: 500 })
  const loans = loansResult?.loans ?? []

  const payableLoans = useMemo(
    () => loans.filter(isPayable),
    [loans],
  )

  // Resolve the active loan object: the fixed prop or the selected one.
  const selectedLoan = useMemo(() => {
    if (lockedLoan) return loan
    return payableLoans.find((l) => String(l.id) === String(form.loanId)) || null
  }, [lockedLoan, loan, payableLoans, form.loanId])

  // A payment on an approved loan that still owes a down payment is collected as
  // a down payment (held until disbursement), not a repayment.
  const downPaymentMode = requiresDownPayment(selectedLoan)

  useEffect(() => {
    if (visible) {
      setForm({ ...emptyForm(), loanId: loan ? String(loan.id) : '' })
      setError(null)
    }
  }, [visible, loan])

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!selectedLoan) {
      setError({ message: 'Please select a loan.' })
      return
    }

    const payload = {
      clientId: selectedLoan.clientId,
      loanId: Number(selectedLoan.id),
      amount: Number(form.amount),
      currency: (selectedLoan.currency || 'KES').toUpperCase(),
      paymentMethod: form.paymentMethod || undefined,
      transactionDate: form.transactionDate,
      externalRef: form.externalRef.trim() || undefined,
      payerName: form.payerName.trim() || undefined,
      payerPhone: form.payerPhone.trim() || undefined,
      notes: form.notes.trim() || undefined,
    }

    try {
      const result = await createMutation.mutateAsync(payload)
      onSuccess?.(result)
      onClose()
    } catch (err) {
      setError(err)
    }
  }

  const validationErrors = error?.data?.errors

  return (
    <CModal visible={visible} onClose={onClose} alignment="center" size="lg">
      <CForm onSubmit={handleSubmit}>
        <CModalHeader>
          <CModalTitle>{downPaymentMode ? 'Record Down Payment' : 'Record Payment'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError(null)}>
              {error.message || 'Failed to record payment.'}
              {Array.isArray(validationErrors) && (
                <ul className="mb-0 mt-2">
                  {validationErrors.map((ve, i) => (
                    <li key={i}>{ve.message || String(ve)}</li>
                  ))}
                </ul>
              )}
            </CAlert>
          )}

          <CRow className="g-3">
            <CCol md={12}>
              <CFormLabel>Loan *</CFormLabel>
              {lockedLoan ? (
                <CFormInput
                  value={`${loan.referenceCode || `Loan #${loan.id}`}`}
                  disabled
                />
              ) : (
                <CFormSelect value={form.loanId} onChange={update('loanId')} required>
                  <option value="">Select a loan…</option>
                  {payableLoans.map((l) => (
                    <option key={l.id} value={l.id}>
                      {(l.referenceCode || `Loan #${l.id}`) +
                        (l.client ? ` — ${l.client.firstName} ${l.client.lastName}`.trim() : ` — Client #${l.clientId}`) +
                        ` (${formatCurrency(l.outstandingBalance, l.currency)} due)`}
                    </option>
                  ))}
                </CFormSelect>
              )}
            </CCol>

            {selectedLoan && (
              <CCol md={12}>
                {downPaymentMode ? (
                  <div className="small text-body-secondary">
                    Down payment required:{' '}
                    <strong>
                      {formatCurrency(selectedLoan.downPaymentRequired, selectedLoan.currency)}
                    </strong>{' '}
                    · Paid:{' '}
                    <strong>
                      {formatCurrency(selectedLoan.downPaymentPaid, selectedLoan.currency)}
                    </strong>{' '}
                    · Outstanding:{' '}
                    <strong>
                      {formatCurrency(downPaymentDue(selectedLoan), selectedLoan.currency)}
                    </strong>
                  </div>
                ) : (
                  <div className="small text-body-secondary">
                    Outstanding principal:{' '}
                    <strong>
                      {formatCurrency(selectedLoan.outstandingBalance, selectedLoan.currency)}
                    </strong>{' '}
                    · Total outstanding (incl. interest & penalties):{' '}
                    <strong>
                      {formatCurrency(
                        selectedLoan.totalOutstandingBalance ?? selectedLoan.outstandingBalance,
                        selectedLoan.currency,
                      )}
                    </strong>{' '}
                    · Currency: <strong>{selectedLoan.currency || 'KES'}</strong>
                  </div>
                )}
              </CCol>
            )}

            <CCol md={6}>
              <CFormLabel>Amount *</CFormLabel>
              <CFormInput
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={update('amount')}
                required
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Transaction date *</CFormLabel>
              <CFormInput
                type="date"
                value={form.transactionDate}
                onChange={update('transactionDate')}
                required
              />
            </CCol>

            <CCol md={6}>
              <CFormLabel>Payment method</CFormLabel>
              <CFormSelect value={form.paymentMethod} onChange={update('paymentMethod')}>
                {PAYMENT_METHOD.values.map((v) => (
                  <option key={v} value={v}>
                    {PAYMENT_METHOD.labels[v]}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              <CFormLabel>External reference</CFormLabel>
              <CFormInput
                value={form.externalRef}
                onChange={update('externalRef')}
                placeholder="e.g. MP250404001234"
              />
            </CCol>

            <CCol md={6}>
              <CFormLabel>Payer name</CFormLabel>
              <CFormInput value={form.payerName} onChange={update('payerName')} />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Payer phone</CFormLabel>
              <CFormInput
                value={form.payerPhone}
                onChange={update('payerPhone')}
                placeholder="+254712345678"
              />
            </CCol>

            <CCol md={12}>
              <CFormLabel>Notes</CFormLabel>
              <CFormTextarea rows={2} value={form.notes} onChange={update('notes')} />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            onClick={onClose}
            disabled={createMutation.isPending}
          >
            Cancel
          </CButton>
          <CButton type="submit" color="primary" disabled={createMutation.isPending}>
            {createMutation.isPending && <CSpinner size="sm" className="me-2" />}
            Record Payment
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

PaymentForm.propTypes = {
  visible: PropTypes.bool.isRequired,
  loan: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
}

PaymentForm.defaultProps = {
  loan: null,
  onSuccess: null,
}

export default PaymentForm
