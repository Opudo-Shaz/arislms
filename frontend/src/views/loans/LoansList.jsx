/**
 * LoansList — server-side paginated, filterable loan table.
 * @module views/loans/LoansList
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormSelect,
  CRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilReload } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import CursorPager from '../../components/CursorPager'
import StatusBadge from '../../components/StatusBadge'
import { useLoans } from '../../hooks/useLoans'
import { useCursorPagination } from '../../hooks/useCursorPagination'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { LOAN_STATUS } from '../../constants/enums'
import { formatCurrency, formatDate } from '../../utils/format'

const PAGE_SIZE = 10

const clientName = (row) =>
  row.client ? `${row.client.firstName} ${row.client.lastName}`.trim() : `Client #${row.clientId}`

const LoansList = () => {
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim())

  const filters = {
    status: status || undefined,
    search: debouncedSearch || undefined,
  }
  const { cursorParams, goTo } = useCursorPagination(filters)
  const params = { ...filters, ...cursorParams, limit: PAGE_SIZE }

  const { data, isLoading, error, refetch, isFetching } = useLoans(params)

  const loans = data?.loans ?? []

  const columns = [
    {
      key: 'reference',
      label: 'Reference',
      render: (row) => (
        <div>
          <div className="fw-semibold">{row.referenceCode || `Loan #${row.id}`}</div>
          <div className="small text-body-secondary">{clientName(row)}</div>
        </div>
      ),
    },
    {
      key: 'amount',
      label: 'Principal',
      render: (row) => (
        <div>
          <div>{formatCurrency(row.principalAmount, row.currency)}</div>
          <div className="small text-body-secondary">{row.interestRate}% · {row.termMonths} mo</div>
        </div>
      ),
    },
    {
      key: 'balance',
      label: 'Outstanding',
      render: (row) => formatCurrency(row.outstandingBalance, row.currency),
    },
    {
      key: 'startDate',
      label: 'Start',
      render: (row) => formatDate(row.startDate),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge enumDef={LOAN_STATUS} value={row.status} />,
    },
  ]

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Loans</strong>
        <CButton color="light" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <CIcon icon={cilReload} className="me-1" />
          Refresh
        </CButton>
      </CCardHeader>
      <CCardBody>
        <CRow className="g-2 mb-3">
          <CCol md={5}>
            <CFormInput
              placeholder="Search reference, client name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </CCol>
          <CCol md={4}>
            <CFormSelect value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {LOAN_STATUS.values.map((v) => (
                <option key={v} value={v}>
                  {LOAN_STATUS.labels[v]}
                </option>
              ))}
            </CFormSelect>
          </CCol>
        </CRow>

        <DataTable
          columns={columns}
          rows={loans}
          loading={isLoading}
          error={error}
          emptyMessage="No loans match your filters."
          onRowClick={(row) => navigate(`/loans/${row.id}`)}
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

export default LoansList
