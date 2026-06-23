/**
 * PaymentsList
 *
 * Filterable table of all recorded payments (admin/manager). Loan reference and
 * client name are resolved from the loans/clients caches since the payment
 * record only carries `loanId`. Supports recording a new payment and deleting
 * an existing one.
 *
 * @module views/payments/PaymentsList
 */

import React, { useMemo, useState } from 'react'
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
import { cilMagnifyingGlass, cilPlus, cilReload, cilTrash } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ConfirmModal from '../../components/ConfirmModal'
import PaymentForm from './PaymentForm'
import PaymentDetailModal from './PaymentDetailModal'
import { usePayments, useDeletePayment } from '../../hooks/usePayments'
import { useLoans } from '../../hooks/useLoans'
import { useClients } from '../../hooks/useClients'
import { PAYMENT_STATUS, PAYMENT_METHOD } from '../../constants/enums'
import { formatCurrency, formatDateTime } from '../../utils/format'

const PaymentsList = () => {
  const navigate = useNavigate()
  const { data: payments = [], isLoading, error, refetch, isFetching } = usePayments()
  const { data: loans = [] } = useLoans()
  const { data: clients = [] } = useClients()
  const deleteMutation = useDeletePayment()

  const [showForm, setShowForm] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const [viewPayment, setViewPayment] = useState(null)
  const [search, setSearch] = useState('')
  const [method, setMethod] = useState('')

  const loanMap = useMemo(() => {
    const map = {}
    loans.forEach((l) => {
      map[l.id] = l
    })
    return map
  }, [loans])

  const clientMap = useMemo(() => {
    const map = {}
    clients.forEach((c) => {
      map[c.id] = `${c.firstName} ${c.lastName}`.trim()
    })
    return map
  }, [clients])

  const loanLabel = (loanId) => {
    const loan = loanMap[loanId]
    if (!loan) return `Loan #${loanId}`
    return loan.referenceCode || `Loan #${loanId}`
  }

  const clientLabel = (loanId) => {
    const loan = loanMap[loanId]
    return loan ? clientMap[loan.clientId] || `Client #${loan.clientId}` : ''
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return payments.filter((p) => {
      if (method && (p.method || '').toUpperCase() !== method) return false
      if (term) {
        const haystack = [loanLabel(p.loanId), clientLabel(p.loanId), p.amount, p.method, p.externalRef]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [payments, method, search, loanMap, clientMap])

  const columns = [
    {
      key: 'loan',
      label: 'Loan',
      render: (row) => (
        <div>
          <a
            href={`/loans/${row.loanId}`}
            className="fw-semibold"
            onClick={(e) => {
              e.preventDefault()
              navigate(`/loans/${row.loanId}`)
            }}
          >
            {loanLabel(row.loanId)}
          </a>
          <div className="small text-body-secondary">{clientLabel(row.loanId)}</div>
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
          <CButton
            color="light"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              setViewPayment(row)
            }}
          >
            <CIcon icon={cilMagnifyingGlass} />
          </CButton>
          <CButton
            color="danger"
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              setToDelete(row)
            }}
          >
            <CIcon icon={cilTrash} />
          </CButton>
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
          <CButton color="primary" size="sm" onClick={() => setShowForm(true)}>
            <CIcon icon={cilPlus} className="me-1" />
            Record Payment
          </CButton>
        </div>
      </CCardHeader>
      <CCardBody>
        <CRow className="g-2 mb-3">
          <CCol md={5}>
            <CFormInput
              placeholder="Search loan, client, external ref…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </CCol>
          <CCol md={4}>
            <CFormSelect value={method} onChange={(e) => setMethod(e.target.value)}>
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
          rows={filtered}
          loading={isLoading}
          error={error}
          emptyMessage="No payments match your filters."
          onRowClick={(row) => setViewPayment(row)}
        />
      </CCardBody>

      <PaymentForm visible={showForm} onClose={() => setShowForm(false)} />

      <PaymentDetailModal
        visible={Boolean(viewPayment)}
        payment={viewPayment}
        loanLabel={viewPayment ? loanLabel(viewPayment.loanId) : null}
        clientLabel={viewPayment ? clientLabel(viewPayment.loanId) : null}
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
