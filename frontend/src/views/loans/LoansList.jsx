/**
 * LoansList — server-side paginated, filterable loan table.
 * scope='all': every loan (admin/manager). scope='mine': logged-in user's loans.
 * @module views/loans/LoansList
 */

import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormSelect,
  CPagination,
  CPaginationItem,
  CRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilReload } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import { useLoans, useMyLoans } from '../../hooks/useLoans'
import { LOAN_STATUS } from '../../constants/enums'
import { formatCurrency, formatDate } from '../../utils/format'

const PAGE_SIZE = 20

const clientName = (row) =>
  row.client ? `${row.client.firstName} ${row.client.lastName}`.trim() : `Client #${row.clientId}`

const LoansList = ({ scope }) => {
  const navigate = useNavigate()
  const isMine = scope === 'mine'

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const resetPageAnd = (setter) => (value) => { setter(value); setPage(1) }

  const params = {
    page,
    limit: PAGE_SIZE,
    status: status || undefined,
    search: search.trim() || undefined,
  }

  const allLoansQuery = useLoans(params)
  const myLoansQuery = useMyLoans(params)
  const { data, isLoading, error, refetch, isFetching } = isMine ? myLoansQuery : allLoansQuery

  const loans = data?.loans ?? []
  const total = data?.pagination?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const columns = [
    {
      key: 'reference',
      label: 'Reference',
      render: (row) => (
        <div>
          <div className="fw-semibold">{row.referenceCode || `Loan #${row.id}`}</div>
          {!isMine && (
            <div className="small text-body-secondary">{clientName(row)}</div>
          )}
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
        <strong>{isMine ? 'My Loans' : 'Loans'}</strong>
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
              onChange={(e) => resetPageAnd(setSearch)(e.target.value)}
            />
          </CCol>
          <CCol md={4}>
            <CFormSelect value={status} onChange={(e) => resetPageAnd(setStatus)(e.target.value)}>
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

        {totalPages > 1 && (
          <div className="d-flex justify-content-between align-items-center mt-3">
            <span className="small text-body-secondary">
              {total} loans · page {page} of {totalPages}
            </span>
            <CPagination className="mb-0">
              <CPaginationItem disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </CPaginationItem>
              <CPaginationItem disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </CPaginationItem>
            </CPagination>
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}

LoansList.propTypes = {
  scope: PropTypes.oneOf(['all', 'mine']),
}

LoansList.defaultProps = {
  scope: 'all',
}

export default LoansList
