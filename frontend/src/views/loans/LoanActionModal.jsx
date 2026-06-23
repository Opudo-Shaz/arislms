/**
 * LoanActionModal
 *
 * Confirmation dialog for loan lifecycle actions that require a single input:
 * - `approve`   → approval date (YYYY-MM-DD)
 * - `disburse`  → disbursement date (YYYY-MM-DD)
 * - `principal` → new principal amount (number)
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
}

const LoanActionModal = ({ visible, action, defaultValue, loading, error, onConfirm, onClose }) => {
  const cfg = action ? CONFIG[action] : null
  const [value, setValue] = useState('')

  useEffect(() => {
    if (visible && cfg) {
      setValue(defaultValue ?? (cfg.type === 'date' ? today() : ''))
    }
  }, [visible, action, defaultValue]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!cfg) return null

  const handleConfirm = (e) => {
    e.preventDefault()
    if (!String(value).trim()) return
    onConfirm(value)
  }

  return (
    <CModal visible={visible} onClose={onClose} alignment="center">
      <CForm onSubmit={handleConfirm}>
        <CModalHeader>
          <CModalTitle>{cfg.title}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && <CAlert color="danger" dismissible>{error.message || 'Action failed.'}</CAlert>}
          <CFormLabel>{cfg.label} *</CFormLabel>
          <CFormInput
            type={cfg.type}
            value={value}
            min={cfg.type === 'number' ? '0' : undefined}
            step={cfg.type === 'number' ? '0.01' : undefined}
            onChange={(e) => setValue(e.target.value)}
            required
          />
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
  action: PropTypes.oneOf(['approve', 'disburse', 'principal']),
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
