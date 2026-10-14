/**
 * Client portal: recorded payments across the client's loans, plus the
 * payments they've reported (and whether staff have confirmed them).
 *
 * @component
 */

import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { CButton, CCard, CCardBody, CCardHeader, CNav, CNavItem, CNavLink } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilTask } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import CursorPager from '../../components/CursorPager'
import StatusBadge from '../../components/StatusBadge'
import { usePortalPayments, usePortalPaymentReports } from '../../hooks/usePortal'
import { useCursorPagination } from '../../hooks/useCursorPagination'
import { PAYMENT_METHOD, PAYMENT_REPORT_STATUS, PAYMENT_STATUS, enumLabel } from '../../constants/enums'
import { formatCurrency, formatDateTime } from '../../utils/format'

const PAGE_SIZE = 10

const paymentColumns = [
  { key: 'date', label: 'Date', render: (r) => formatDateTime(r.paymentDate || r.transactionDate) },
  { key: 'loan', label: 'Loan', render: (r) => r.loanReference || '—' },
  { key: 'amount', label: 'Amount', render: (r) => formatCurrency(r.amount, r.currency) },
  { key: 'method', label: 'Method', render: (r) => (r.method ? enumLabel(PAYMENT_METHOD, r.method) : '—') },
  { key: 'ref', label: 'Reference', render: (r) => r.externalRef || '—' },
  { key: 'status', label: 'Status', render: (r) => <StatusBadge enumDef={PAYMENT_STATUS} value={r.status} /> },
]

const reportColumns = [
  { key: 'reported', label: 'Reported', render: (r) => formatDateTime(r.createdAt) },
  { key: 'paid', label: 'Paid on', render: (r) => formatDateTime(r.transactionDate) },
  { key: 'amount', label: 'Amount', render: (r) => formatCurrency(r.amount, r.currency) },
  { key: 'ref', label: 'Reference', render: (r) => r.externalRef },
  {
    key: 'status',
    label: 'Status',
    render: (r) => (
      <div>
        <StatusBadge enumDef={PAYMENT_REPORT_STATUS} value={r.status} />
        {r.status === 'rejected' && r.reviewNotes ? (
          <div className="small text-body-secondary mt-1">{r.reviewNotes}</div>
        ) : null}
      </div>
    ),
  },
]

const PaymentsTab = () => {
  const { cursorParams, goTo } = useCursorPagination({})
  const { data, isLoading, error, isFetching } = usePortalPayments({ ...cursorParams, limit: PAGE_SIZE })
  const rows = data?.data ?? []
  return (
    <>
      <DataTable columns={paymentColumns} rows={rows} loading={isLoading} error={error} emptyMessage="No payments recorded yet." />
      <CursorPager pagination={data?.pagination} onNavigate={goTo} disabled={isFetching} summary={`Showing ${rows.length}`} />
    </>
  )
}

const ReportsTab = () => {
  const { cursorParams, goTo } = useCursorPagination({})
  const { data, isLoading, error, isFetching } = usePortalPaymentReports({ ...cursorParams, limit: PAGE_SIZE })
  const rows = data?.data ?? []
  return (
    <>
      <p className="small text-body-secondary">
        Payments you reported are checked against our statement and then applied to your loan.
      </p>
      <DataTable columns={reportColumns} rows={rows} loading={isLoading} error={error} emptyMessage="You haven't reported any payments." />
      <CursorPager pagination={data?.pagination} onNavigate={goTo} disabled={isFetching} summary={`Showing ${rows.length}`} />
    </>
  )
}

const MyPayments = () => {
  const [tab, setTab] = useState('payments')
  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex align-items-center">
        <strong>My payments</strong>
        <Link to="/portal/report-payment" className="ms-auto">
          <CButton color="primary" size="sm"><CIcon icon={cilTask} className="me-1" />Report a payment</CButton>
        </Link>
      </CCardHeader>
      <CCardBody>
        <CNav variant="tabs" className="mb-3">
          <CNavItem>
            <CNavLink as="button" type="button" active={tab === 'payments'} onClick={() => setTab('payments')}>
              Recorded payments
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink as="button" type="button" active={tab === 'reports'} onClick={() => setTab('reports')}>
              Reported payments
            </CNavLink>
          </CNavItem>
        </CNav>
        {tab === 'payments' ? <PaymentsTab /> : <ReportsTab />}
      </CCardBody>
    </CCard>
  )
}

export default MyPayments
