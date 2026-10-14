/**
 * Client portal: the client's loans (keyset paginated, filterable by status).
 *
 * @component
 */

import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CButton, CCard, CCardBody, CCardHeader, CCol, CFormSelect, CRow } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import CursorPager from '../../components/CursorPager'
import StatusBadge from '../../components/StatusBadge'
import { usePortalLoans } from '../../hooks/usePortal'
import { useCursorPagination } from '../../hooks/useCursorPagination'
import { LOAN_STATUS } from '../../constants/enums'
import { formatCurrency, formatDate } from '../../utils/format'

const PAGE_SIZE = 10

// Statuses a borrower can meaningfully filter by.
const FILTER_STATUSES = ['pending', 'under_review', 'approved', 'active', 'partially_paid', 'overdue', 'closed', 'rejected']

const columns = [
  {
    key: 'reference',
    label: 'Loan',
    render: (row) => (
      <div>
        <div className="fw-semibold">{row.referenceCode}</div>
        <div className="small text-body-secondary">{row.productName || '—'}</div>
      </div>
    ),
  },
  {
    key: 'amount',
    label: 'Amount',
    render: (row) => (
      <div>
        <div>{formatCurrency(row.principalAmount, row.currency)}</div>
        <div className="small text-body-secondary">{row.termMonths} mo · {row.interestRate}%</div>
      </div>
    ),
  },
  {
    key: 'balance',
    label: 'Outstanding',
    render: (row) => formatCurrency(row.totalOutstandingBalance ?? row.outstandingBalance, row.currency),
  },
  { key: 'startDate', label: 'Applied / start', render: (row) => formatDate(row.startDate || row.createdAt) },
  { key: 'status', label: 'Status', render: (row) => <StatusBadge enumDef={LOAN_STATUS} value={row.status} /> },
]

const MyLoans = () => {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const filters = { status: status || undefined }
  const { cursorParams, goTo } = useCursorPagination(filters)
  const { data, isLoading, error, isFetching } = usePortalLoans({ ...filters, ...cursorParams, limit: PAGE_SIZE })
  const loans = data?.data ?? []

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex align-items-center">
        <strong>My loans</strong>
        <Link to="/portal/apply" className="ms-auto">
          <CButton color="primary" size="sm"><CIcon icon={cilPlus} className="me-1" />Apply</CButton>
        </Link>
      </CCardHeader>
      <CCardBody>
        <CRow className="mb-3">
          <CCol sm={6} md={4}>
            <CFormSelect aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {FILTER_STATUSES.map((v) => (
                <option key={v} value={v}>{LOAN_STATUS.labels[v] || v}</option>
              ))}
            </CFormSelect>
          </CCol>
        </CRow>
        <DataTable
          columns={columns}
          rows={loans}
          loading={isLoading}
          error={error}
          emptyMessage={status ? 'No loans with this status.' : 'You have no loans yet.'}
          onRowClick={(row) => navigate(`/portal/loans/${row.id}`)}
        />
        <CursorPager
          pagination={data?.pagination}
          onNavigate={goTo}
          disabled={isFetching}
          summary={`Showing ${loans.length} loan${loans.length === 1 ? '' : 's'}`}
        />
      </CCardBody>
    </CCard>
  )
}

export default MyLoans
