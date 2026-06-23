/**
 * PaymentDetailModal
 *
 * Read-only dialog showing the full details of a recorded payment, including
 * fields not shown in the list (payer phone, external reference, allocation
 * breakdown, processed-by, notes, timestamps).
 *
 * The payment object is reused from the list/loan caches — no extra request.
 *
 * @module views/payments/PaymentDetailModal
 */

import React from 'react'
import PropTypes from 'prop-types'
import {
  CButton,
  CCol,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
} from '@coreui/react'

import StatusBadge from '../../components/StatusBadge'
import { PAYMENT_STATUS } from '../../constants/enums'
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format'

const Field = ({ label, children, md = 6 }) => (
  <CCol md={md} className="mb-3">
    <div className="text-body-secondary small">{label}</div>
    <div>{children ?? '—'}</div>
  </CCol>
)

Field.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node,
  md: PropTypes.number,
}

const PaymentDetailModal = ({ visible, payment, loanLabel, clientLabel, onClose }) => {
  if (!payment) return null

  const currency = payment.currency
  const processor = payment.processedByUser

  return (
    <CModal visible={visible} onClose={onClose} alignment="center" size="lg">
      <CModalHeader>
        <CModalTitle>Payment #{payment.id}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <CRow>
          {loanLabel && <Field label="Loan">{loanLabel}</Field>}
          {clientLabel && <Field label="Client">{clientLabel}</Field>}
          <Field label="Amount">{formatCurrency(payment.amount, currency)}</Field>
          <Field label="Currency">{currency || '—'}</Field>
          <Field label="Method">{payment.method || '—'}</Field>
          <Field label="Status">
            <StatusBadge enumDef={PAYMENT_STATUS} value={payment.status} />
          </Field>
          <Field label="External Reference">{payment.externalRef || '—'}</Field>
          <Field label="Payer Name">{payment.payerName || '—'}</Field>
          <Field label="Payer Phone">{payment.payerPhone || '—'}</Field>
          <Field label="Transaction Date">{formatDate(payment.transactionDate)}</Field>
          <Field label="Applied to Principal">
            {formatCurrency(payment.appliedToPrincipal, currency)}
          </Field>
          <Field label="Applied to Interest">
            {formatCurrency(payment.appliedToInterest, currency)}
          </Field>
          <Field label="Fees">{formatCurrency(payment.fees, currency)}</Field>
          <Field label="Penalties">{formatCurrency(payment.penalties, currency)}</Field>
          <Field label="Created By">
            {processor ? processor.name || processor.email : payment.processedBy || '—'}
          </Field>
          <Field label="Recorded At">{formatDateTime(payment.paymentDate)}</Field>
          {payment.notes && (
            <Field label="Notes" md={12}>
              {payment.notes}
            </Field>
          )}
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" onClick={onClose}>
          Close
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

PaymentDetailModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  payment: PropTypes.object,
  loanLabel: PropTypes.node,
  clientLabel: PropTypes.node,
  onClose: PropTypes.func.isRequired,
}

PaymentDetailModal.defaultProps = {
  payment: null,
  loanLabel: null,
  clientLabel: null,
}

export default PaymentDetailModal
