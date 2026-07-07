/**
 * LoanActionModal
 *
 * Confirmation dialog for loan lifecycle actions that require a single input:
 * - `approve`   → approval date (YYYY-MM-DD)
 * - `disburse`  → disbursement date (YYYY-MM-DD)
 * - `principal` → new principal amount (number)
 * - `reject`    → rejection note (textarea, required)
 *
 * @module views/loans/LoanActionModal
 */

import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'

/** Today as YYYY-MM-DD for date defaults. */
const today = () => new Date().toISOString().slice(0, 10)

const CONFIG = {
  approve: {
    title: 'Approve Loan',
    label: 'Approval date',
    type: 'date',
    confirmText: 'Approve',
    color: 'primary',
  },
  disburse: {
    title: 'Disburse Loan',
    label: 'Disbursement date',
    type: 'date',
    confirmText: 'Disburse',
    color: 'success',
  },
  principal: {
    title: 'Update Principal Amount',
    label: 'New principal amount',
    type: 'number',
    confirmText: 'Update',
    color: 'warning',
  },
  reject: {
    title: 'Reject Loan Application',
    label: 'Rejection reason *',
    type: 'textarea',
    confirmText: 'Reject',
    color: 'danger',
  },
  write_off: {
    title: 'Write Off Loan',
    type: 'write_off',
    confirmText: 'Write Off',
    color: 'danger',
  },
}

const LoanActionModal = ({ visible, action, defaultValue, loading, error, onConfirm, onClose }) => {
  const cfg = action ? CONFIG[action] : null
  const [value, setValue] = useState('')
  const [writeOffAmount, setWriteOffAmount] = useState('')
  const [writeOffReason, setWriteOffReason] = useState('')

  useEffect(() => {
    if (visible && cfg) {
      if (cfg.type === 'write_off') {
        setWriteOffAmount(defaultValue != null ? String(defaultValue) : '')
        setWriteOffReason('')
      } else {
        setValue(defaultValue ?? (cfg.type === 'date' ? today() : ''))
      }
    }
  }, [visible, action, defaultValue]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!cfg) return null

  const handleConfirm = (e) => {
    e.preventDefault()
    if (cfg.type === 'write_off') {
      if (!String(writeOffReason).trim()) return
      onConfirm({
        writeOffAmount: writeOffAmount ? parseFloat(writeOffAmount) : undefined,
        reason: String(writeOffReason).trim(),
      })
    } else {
      if (!String(value).trim()) return
      onConfirm(value)
    }
  }

  return (
    <CModal visible={visible} onClose={onClose} alignment="center">
      <CForm onSubmit={handleConfirm}>
        <CModalHeader>
          <CModalTitle>{cfg.title}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && <CAlert color="danger" dismissible>{error.message || 'Action failed.'}</CAlert>}
          {cfg.type === 'write_off' ? (
            <>
              <div className="mb-3">
                <CFormLabel>
                  Write-off amount{' '}
                  <span className="text-body-secondary small">
                    (leave blank to write off full outstanding balance)
                  </span>
                </CFormLabel>
                <CFormInput
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={writeOffAmount}
                  onChange={(e) => setWriteOffAmount(e.target.value)}
                  placeholder={defaultValue != null ? `Max: ${defaultValue}` : 'Full outstanding balance'}
                />
              </div>
              <div>
                <CFormLabel>Reason *</CFormLabel>
                <CFormTextarea
                  rows={4}
                  value={writeOffReason}
                  onChange={(e) => setWriteOffReason(e.target.value)}
                  placeholder="Provide a clear reason for the write-off…"
                  required
                />
              </div>
            </>
          ) : (
            <>
              <CFormLabel>{cfg.label}</CFormLabel>
              {cfg.type === 'textarea' ? (
                <CFormTextarea
                  rows={4}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Provide a clear reason for rejection…"
                  required
                />
              ) : (
                <CFormInput
                  type={cfg.type}
                  value={value}
                  min={cfg.type === 'number' ? '0' : undefined}
                  step={cfg.type === 'number' ? '0.01' : undefined}
                  onChange={(e) => setValue(e.target.value)}
                  required
                />
              )}
            </>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </CButton>
          <CButton type="submit" color={cfg.color} disabled={loading}>
            {loading && <CSpinner size="sm" className="me-2" />}
            {cfg.confirmText}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

LoanActionModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  action: PropTypes.oneOf(['approve', 'disburse', 'principal', 'reject', 'write_off']),
  defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  loading: PropTypes.bool,
  error: PropTypes.object,
  onConfirm: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
}

LoanActionModal.defaultProps = {
  action: null,
  defaultValue: null,
  loading: false,
  error: null,
}

export default LoanActionModal
