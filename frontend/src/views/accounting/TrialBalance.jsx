/**
 * TrialBalance
 *
 * Displays the trial balance (per-account debit/credit totals and balances) as
 * of an optional date, with a balanced/unbalanced indicator and grand totals.
 *
 * @module views/accounting/TrialBalance
 */

import React, { useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CRow,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableFoot,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilReload } from '@coreui/icons'

import StatusBadge from '../../components/StatusBadge'
import { useTrialBalance } from '../../hooks/useLedger'
import { ACCOUNT_TYPE } from '../../constants/enums'
import { formatCurrency } from '../../utils/format'

const TrialBalance = () => {
  const [asOf, setAsOf] = useState('')
  const { data, isLoading, error, refetch, isFetching } = useTrialBalance(asOf || undefined)

  const accounts = data?.accounts ?? []

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Trial Balance</strong>
        <CButton color="light" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <CIcon icon={cilReload} className="me-1" />
          Refresh
        </CButton>
      </CCardHeader>
      <CCardBody>
        <CRow className="g-2 mb-3 align-items-end">
          <CCol md={4}>
            <label className="form-label">As of date</label>
            <CFormInput type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </CCol>
          {data && (
            <CCol md={8} className="text-md-end">
              <CAlert
                color={data.balanced ? 'success' : 'danger'}
                className="d-inline-block mb-0 py-2 px-3"
              >
                {data.balanced ? 'Books are balanced' : 'Books are NOT balanced'}
              </CAlert>
            </CCol>
          )}
        </CRow>

        {isLoading && <div className="text-center py-5 text-body-secondary">Loading…</div>}
        {!isLoading && error && (
          <div className="text-center py-5 text-danger">
            {error.message || 'Failed to load trial balance.'}
          </div>
        )}

        {!isLoading && !error && (
          <CTable hover responsive align="middle" className="mb-0 border">
            <CTableHead className="text-nowrap">
              <CTableRow>
                <CTableHeaderCell>Code</CTableHeaderCell>
                <CTableHeaderCell>Account</CTableHeaderCell>
                <CTableHeaderCell>Type</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Debit</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Credit</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Balance</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {accounts.length === 0 && (
                <CTableRow>
                  <CTableDataCell colSpan={6} className="text-center text-body-secondary py-5">
                    No account activity to display.
                  </CTableDataCell>
                </CTableRow>
              )}
              {accounts.map((a) => (
                <CTableRow key={a.code}>
                  <CTableDataCell className="fw-semibold">{a.code}</CTableDataCell>
                  <CTableDataCell>{a.name}</CTableDataCell>
                  <CTableDataCell>
                    <StatusBadge enumDef={ACCOUNT_TYPE} value={a.type} />
                  </CTableDataCell>
                  <CTableDataCell className="text-end">
                    {a.totalDebit ? formatCurrency(a.totalDebit) : '—'}
                  </CTableDataCell>
                  <CTableDataCell className="text-end">
                    {a.totalCredit ? formatCurrency(a.totalCredit) : '—'}
                  </CTableDataCell>
                  <CTableDataCell className="text-end">{formatCurrency(a.balance)}</CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
            {data && (
              <CTableFoot>
                <CTableRow className="fw-semibold">
                  <CTableDataCell colSpan={3} className="text-end">
                    Grand totals
                  </CTableDataCell>
                  <CTableDataCell className="text-end">
                    {formatCurrency(data.grandDebit)}
                  </CTableDataCell>
                  <CTableDataCell className="text-end">
                    {formatCurrency(data.grandCredit)}
                  </CTableDataCell>
                  <CTableDataCell className="text-end">
                    {formatCurrency(data.grandDebit - data.grandCredit)}
                  </CTableDataCell>
                </CTableRow>
              </CTableFoot>
            )}
          </CTable>
        )}
      </CCardBody>
    </CCard>
  )
}

export default TrialBalance
