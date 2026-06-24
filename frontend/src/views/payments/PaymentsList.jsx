/**
 * PaymentsList — server-side paginated payment table.
 * Loan reference and client name come from the embedded `row.loan` object,
 * eliminating the need to fetch all loans and clients separately.
 * @module views/payments/PaymentsList
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormSelect,
  CPagination,
  CPaginationItem,
  CRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilMagnifyingGlass, cilPlus, cilReload, cilTrash } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ConfirmModal from '../../components/ConfirmModal'
import PaymentForm from './PaymentForm'
import PaymentDetailModal from './PaymentDetailModal'
import { usePayments, useDeletePayment } from '../../hooks/usePayments'
import { useAuth } from '../../context/AuthContext'
import { PAYMENT_STATUS, PAYMENT_METHOD, ROLE_GROUPS } from '../../constants/enums'
import { formatCurrency, formatDateTime } from '../../utils/format'

const PAGE_SIZE = 20

const loanLabel = (row) => row.loan?.referenceCode || `Loan #${row.loanId}`
const clientLabel = (row) => {
  const c = row.loan?.client
  return c ? `${c.firstName} ${c.lastName}`.trim() : ''
}

const PaymentsList = () => {
  const navigate = useNavigate()
  const deleteMutation = useDeletePayment()
  const { role } = useAuth()
  const canManage = ROLE_GROUPS.STAFF.includes(role)

  const [showForm, setShowForm] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const [viewPayment, setViewPayment] = useState(null)
  const [method, setMethod] = useState('')
  const [page, setPage] = useState(1)

  const params = { page, limit: PAGE_SIZE, method: method || undefined }
  const { data, isLoading, error, refetch, isFetching } = usePayments(params)

  const payments = data?.payments ?? []
  const total = data?.pagination?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const columns = [
    {
      key: 'loan',
      label: 'Loan',
      render: (row) => (
        <div>
          <a
            href={`/loans/${row.loanId}`}
            className="fw-semibold"
            onClick={(e) => { e.preventDefault(); navigate(`/loans/${row.loanId}`) }}
          >
            {loanLabel(row)}
          </a>
          <div className="small text-body-secondary">{clientLabel(row)}</div>
        </div>
      ),
    },
    { key: 'amount', label: 'Amount', render: (row) => formatCurrency(row.amount, row.currency) },
    { key: 'externalRef', label: 'External Ref', render: (row) => row.externalRef || '—' },
    { key: 'method', label: 'Method', render: (row) => row.method || '—' },
    {
      key: 'transactionDate',
      label: 'Date',
      render: (row) => formatDateTime(row.paymentDate || row.transactionDate),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge enumDef={PAYMENT_STATUS} value={row.status} />,
    },
    {
      key: 'actions',
      label: '',
      className: 'text-end',
      render: (row) => (
        <div className="d-flex gap-2 justify-content-end">
          <CButton color="light" size="sm" onClick={(e) => { e.stopPropagation(); setViewPayment(row) }}>
            <CIcon icon={cilMagnifyingGlass} />
          </CButton>
          {canManage && (
            <CButton
              color="danger"
              size="sm"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); setToDelete(row) }}
            >
              <CIcon icon={cilTrash} />
            </CButton>
          )}
        </div>
      ),
    },
  ]

  const runDelete = async () => {
    try {
      await deleteMutation.mutateAsync(toDelete.id)
      setToDelete(null)
    } catch {
      // Error surfaced via mutation state; modal stays open.
    }
  }

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Payments</strong>
        <div className="d-flex gap-2">
          <CButton color="light" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <CIcon icon={cilReload} className="me-1" />
            Refresh
          </CButton>
          {canManage && (
            <CButton color="primary" size="sm" onClick={() => setShowForm(true)}>
              <CIcon icon={cilPlus} className="me-1" />
              Record Payment
            </CButton>
          )}
        </div>
      </CCardHeader>
      <CCardBody>
        <CRow className="g-2 mb-3">
          <CCol md={5}>
            <CFormSelect
              value={method}
              onChange={(e) => { setMethod(e.target.value); setPage(1) }}
            >
              <option value="">All methods</option>
              {PAYMENT_METHOD.values.map((v) => (
                <option key={v} value={v}>
                  {PAYMENT_METHOD.labels[v]}
                </option>
              ))}
            </CFormSelect>
          </CCol>
        </CRow>

        <DataTable
          columns={columns}
          rows={payments}
          loading={isLoading}
          error={error}
          emptyMessage="No payments match your filters."
          onRowClick={(row) => setViewPayment(row)}
        />

        {totalPages > 1 && (
          <div className="d-flex justify-content-between align-items-center mt-3">
            <span className="small text-body-secondary">
              {total} payments · page {page} of {totalPages}
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

      <PaymentForm visible={showForm} onClose={() => setShowForm(false)} />

      <PaymentDetailModal
        visible={Boolean(viewPayment)}
        payment={viewPayment}
        loanLabel={viewPayment ? loanLabel(viewPayment) : null}
        clientLabel={viewPayment ? clientLabel(viewPayment) : null}
        onClose={() => setViewPayment(null)}
      />

      <ConfirmModal
        visible={Boolean(toDelete)}
        title="Delete Payment"
        body="Deleting this payment reverses its effect on the loan balance and schedule. Continue?"
        confirmText="Delete"
        confirmColor="danger"
        loading={deleteMutation.isPending}
        onConfirm={runDelete}
        onClose={() => setToDelete(null)}
      />
    </CCard>
  )
}

export default PaymentsList

