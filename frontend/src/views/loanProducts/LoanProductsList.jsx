/**
 * LoanProductsList
 *
 * Table of loan products with inline create/edit (modal form) and delete.
 *
 * @module views/loanProducts/LoanProductsList
 */

import React, { useState } from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPencil, cilPlus, cilReload, cilTrash } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ConfirmModal from '../../components/ConfirmModal'
import LoanProductForm from './LoanProductForm'
import { useLoanProducts, useDeleteLoanProduct } from '../../hooks/useLoanProducts'
import { INTEREST_TYPE } from '../../constants/enums'
import { formatCurrency, formatPercent } from '../../utils/format'

const LoanProductsList = () => {
  const { data: products = [], isLoading, error, refetch, isFetching } = useLoanProducts()
  const deleteMutation = useDeleteLoanProduct()

  const [editing, setEditing] = useState(null) // product object, or {} for new
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  const runDelete = async () => {
    setDeleteError(null)
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(err)
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <div>
          <div className="fw-semibold">{row.name}</div>
          {row.description && (
            <div className="small text-body-secondary text-truncate" style={{ maxWidth: 280 }}>
              {row.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'interest',
      label: 'Interest',
      render: (row) => (
        <div>
          <div>{formatPercent(row.interestRate)}</div>
          <StatusBadge enumDef={INTEREST_TYPE} value={row.interestType} />
        </div>
      ),
    },
    {
      key: 'amount',
      label: 'Amount Range',
      render: (row) =>
        `${formatCurrency(row.minLoanAmount, row.currency)} – ${formatCurrency(
          row.maxLoanAmount,
          row.currency,
        )}`,
    },
    {
      key: 'term',
      label: 'Term',
      render: (row) => `${row.repaymentPeriodMonths ?? '—'} mo`,
    },
    {
      key: 'collateral',
      label: 'Collateral',
      render: (row) =>
        row.requiresCollateral ? (
          <CBadge color="info">Required</CBadge>
        ) : (
          <span className="text-body-secondary">Not required</span>
        ),
    },
    {
      key: 'actions',
      label: '',
      headerClassName: 'text-end',
      className: 'text-end text-nowrap',
      render: (row) => (
        <>
          <CButton
            size="sm"
            color="light"
            className="me-2"
            onClick={(e) => {
              e.stopPropagation()
              setEditing(row)
            }}
          >
            <CIcon icon={cilPencil} />
          </CButton>
          <CButton
            size="sm"
            color="danger"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              setDeleteError(null)
              setDeleteTarget(row)
            }}
          >
            <CIcon icon={cilTrash} />
          </CButton>
        </>
      ),
    },
  ]

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Loan Products</strong>
        <div className="d-flex gap-2">
          <CButton color="light" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <CIcon icon={cilReload} className="me-1" />
            Refresh
          </CButton>
          <CButton color="primary" size="sm" onClick={() => setEditing({})}>
            <CIcon icon={cilPlus} className="me-1" />
            New Product
          </CButton>
        </div>
      </CCardHeader>
      <CCardBody>
        <DataTable
          columns={columns}
          rows={products}
          loading={isLoading}
          error={error}
          emptyMessage="No loan products yet."
        />
      </CCardBody>

      <LoanProductForm
        visible={Boolean(editing)}
        product={editing && editing.id ? editing : null}
        onClose={() => setEditing(null)}
      />

      <ConfirmModal
        visible={Boolean(deleteTarget)}
        title="Delete Loan Product"
        body={
          <>
            Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            {deleteError && <div className="text-danger mt-2">{deleteError.message}</div>}
          </>
        }
        confirmText="Delete"
        confirmColor="danger"
        loading={deleteMutation.isPending}
        onConfirm={runDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </CCard>
  )
}

export default LoanProductsList
