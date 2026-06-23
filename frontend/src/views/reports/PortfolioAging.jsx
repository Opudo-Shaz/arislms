/**
 * PortfolioAging
 *
 * Portfolio aging report: outstanding principal bucketed by days overdue as of a
 * chosen date. Renders a bar chart plus a table with grand totals, mirroring the
 * Trial Balance layout. Data comes from the backend `/reports/portfolio-aging`
 * endpoint (single source of truth for the days-overdue / bucket math).
 *
 * @module views/reports/PortfolioAging
 */

import React, { useState } from 'react'
import {
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
import { CChartBar } from '@coreui/react-chartjs'
import CIcon from '@coreui/icons-react'
import { cilReload } from '@coreui/icons'

import { usePortfolioAging } from '../../hooks/useReports'
import { formatCurrency } from '../../utils/format'

// Bucket bar colors: green (current) -> red (most overdue).
const BUCKET_COLORS = ['#2eb85c', '#f9b115', '#f86c3b', '#e55353', '#8a1c1c']

const PortfolioAging = () => {
  const [asOf, setAsOf] = useState('')
  const { data, isLoading, error, refetch, isFetching } = usePortfolioAging(asOf || undefined)

  const buckets = data?.buckets ?? []
  const totals = data?.totals ?? { principalOutstanding: 0, count: 0 }

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Portfolio Aging</strong>
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
          {data?.asOf && (
            <CCol md={8} className="text-md-end text-body-secondary">
              Outstanding principal as of <strong>{data.asOf}</strong>
            </CCol>
          )}
        </CRow>

        {isLoading && <div className="text-center py-5 text-body-secondary">Loading…</div>}
        {!isLoading && error && (
          <div className="text-center py-5 text-danger">
            {error.message || 'Failed to load portfolio aging.'}
          </div>
        )}

        {!isLoading && !error && (
          <>
            {buckets.length > 0 && (
              <div className="mb-4">
                <CChartBar
                  data={{
                    labels: buckets.map((b) => b.label),
                    datasets: [
                      {
                        label: 'Principal Outstanding',
                        backgroundColor: buckets.map((_, i) => BUCKET_COLORS[i] || '#636f83'),
                        data: buckets.map((b) => b.principalOutstanding),
                      },
                    ],
                  }}
                  options={{
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } },
                  }}
                  style={{ maxHeight: 280 }}
                />
              </div>
            )}

            <CTable hover responsive align="middle" className="mb-0 border">
              <CTableHead className="text-nowrap">
                <CTableRow>
                  <CTableHeaderCell>Bucket (days overdue)</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Installments</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Principal Outstanding</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">% of Total</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {buckets.length === 0 && (
                  <CTableRow>
                    <CTableDataCell colSpan={4} className="text-center text-body-secondary py-5">
                      No outstanding installments.
                    </CTableDataCell>
                  </CTableRow>
                )}
                {buckets.map((b) => {
                  const pct =
                    totals.principalOutstanding > 0
                      ? (b.principalOutstanding / totals.principalOutstanding) * 100
                      : 0
                  return (
                    <CTableRow key={b.label}>
                      <CTableDataCell className="fw-semibold">{b.label}</CTableDataCell>
                      <CTableDataCell className="text-end">{b.count}</CTableDataCell>
                      <CTableDataCell className="text-end">
                        {formatCurrency(b.principalOutstanding)}
                      </CTableDataCell>
                      <CTableDataCell className="text-end">{pct.toFixed(1)}%</CTableDataCell>
                    </CTableRow>
                  )
                })}
              </CTableBody>
              {data && (
                <CTableFoot>
                  <CTableRow className="fw-semibold">
                    <CTableDataCell>Total</CTableDataCell>
                    <CTableDataCell className="text-end">{totals.count}</CTableDataCell>
                    <CTableDataCell className="text-end">
                      {formatCurrency(totals.principalOutstanding)}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">100%</CTableDataCell>
                  </CTableRow>
                </CTableFoot>
              )}
            </CTable>
          </>
        )}
      </CCardBody>
    </CCard>
  )
}

export default PortfolioAging
