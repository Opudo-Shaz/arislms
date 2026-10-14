/**
 * AvailableFundsSummary
 *
 * Shows the raw Cash / Bank (1001) balance alongside the amount still
 * available for lending once approved-but-not-disbursed loans are set aside.
 * Loan approval is checked against the "available for lending" figure.
 *
 * @module views/accounting/AvailableFundsSummary
 */

import React from 'react'
import { CCard, CCardBody, CCol, CRow } from '@coreui/react'

import { useAvailableFunds } from '../../hooks/useLedger'
import { formatCurrency } from '../../utils/format'

const Tile = ({ label, value, hint, valueClass = '' }) => (
  <CCol sm={4}>
    <div className="border rounded p-3 h-100">
      <div className="small text-body-secondary text-uppercase fw-semibold">{label}</div>
      <div className={`fs-4 fw-semibold ${valueClass}`}>{value}</div>
      {hint && <div className="small text-body-secondary">{hint}</div>}
    </div>
  </CCol>
)

const AvailableFundsSummary = () => {
  const { data, isLoading, error } = useAvailableFunds()

  if (error) {
    return (
      <CCard className="mb-4">
        <CCardBody className="text-danger">
          {error.message || 'Failed to load available funds.'}
        </CCardBody>
      </CCard>
    )
  }

  const placeholder = isLoading ? '…' : null
  const available = Number(data?.availableForLending ?? 0)
  const count = data?.committedLoanCount ?? 0

  return (
    <CCard className="mb-4">
      <CCardBody>
        <CRow className="g-3">
          <Tile
            label="Cash / Bank balance"
            value={placeholder ?? formatCurrency(data?.balance)}
            hint="Account 1001"
          />
          <Tile
            label="Committed"
            value={placeholder ?? formatCurrency(data?.committed)}
            hint={`${count} approved loan${count === 1 ? '' : 's'} awaiting disbursement`}
          />
          <Tile
            label="Available for lending"
            value={placeholder ?? formatCurrency(available)}
            hint="New approvals are checked against this"
            valueClass={!isLoading && available <= 0 ? 'text-danger' : 'text-success'}
          />
        </CRow>
      </CCardBody>
    </CCard>
  )
}

export default AvailableFundsSummary
