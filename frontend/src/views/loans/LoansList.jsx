/**
 * LoansList
 *
 * Filterable table of loans. Supports two scopes:
 * - `all` (default): every loan (admin/manager) via `useLoans`.
 * - `mine`: the logged-in user's loans via `useMyLoans`.
 *
 * Client names are resolved from the Clients list (loans only carry a
 * `clientId`). Rows link to the loan detail page.
 *
 * @module views/loans/LoansList
 */

import React, { useMemo, useState } from 'react'
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
  CRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilReload } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import { useLoans, useMyLoans } from '../../hooks/useLoans'
import { useClients } from '../../hooks/useClients'
import { LOAN_STATUS } from '../../constants/enums'
import { formatCurrency, formatDate } from '../../utils/format'

const LoansList = ({ scope }) => {
  const navigate = useNavigate()
  const isMine = scope === 'mine'

  const allLoansQuery = useLoans()
  const myLoansQuery = useMyLoans()
  const { data: loans = [], isLoading, error, refetch, isFetching } = isMine
    ? myLoansQuery
    : allLoansQuery

  // Resolve client names (loans only carry clientId). Skipped for "mine".
  const { data: clients = [] } = useClients()
  const clientMap = useMemo(() => {
    const map = {}
    clients.forEach((c) => {
      map[c.id] = `${c.firstName} ${c.lastName}`.trim()
    })
    return map
  }, [clients])

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return loans.filter((l) => {
      if (status && l.status !== status) return false
      if (term) {
        const haystack = [l.referenceCode, clientMap[l.clientId], l.principalAmount]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [loans, status, search, clientMap])

  const columns = [
    {
      key: 'reference',
      label: 'Reference',
      render: (row) => (
        <div>
          <div className="fw-semibold">{row.referenceCode || `Loan #${row.id}`}</div>
          {!isMine && (
            <div className="small text-body-secondary">
              {clientMap[row.clientId] || `Client #${row.clientId}`}
            </div>
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
        <div className="d-flex gap-2">
          <CButton color="light" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <CIcon icon={cilReload} className="me-1" />
            Refresh
          </CButton>
          <CButton color="primary" size="sm" onClick={() => navigate('/loans/new')}>
            <CIcon icon={cilPlus} className="me-1" />
            New Application
          </CButton>
        </div>
      </CCardHeader>
      <CCardBody>
        <CRow className="g-2 mb-3">
          <CCol md={5}>
            <CFormInput
              placeholder="Search reference, client…"
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
          rows={filtered}
          loading={isLoading}
          error={error}
          emptyMessage="No loans match your filters."
          onRowClick={(row) => navigate(`/loans/${row.id}`)}
        />
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
