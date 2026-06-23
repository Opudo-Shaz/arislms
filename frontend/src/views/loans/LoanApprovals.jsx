/**
 * LoanApprovals
 *
 * Approval queue listing loans awaiting an admin decision (post credit-scoring
 * statuses). Each row can be approved inline via a date dialog; rows also link
 * to the loan detail page for a fuller review.
 *
 * @module views/loans/LoanApprovals
 */

import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCheckAlt, cilReload } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import LoanActionModal from './LoanActionModal'
import { useLoans, useLoanAction } from '../../hooks/useLoans'
import { useClients } from '../../hooks/useClients'
import { LOAN_STATUS } from '../../constants/enums'
import { formatCurrency, formatDate } from '../../utils/format'

/** Loan statuses that still require an approval decision. */
const PENDING_STATUSES = [
  'pending',
  'pending_reverification',
  'verified',
  'in_review',
  'under_review',
]

const LoanApprovals = () => {
  const navigate = useNavigate()
  const { data: loans = [], isLoading, error, refetch, isFetching } = useLoans()
  const { data: clients = [] } = useClients()
  const approveAction = useLoanAction()

  const [target, setTarget] = useState(null)
  const [actionError, setActionError] = useState(null)

  const clientMap = useMemo(() => {
    const map = {}
    clients.forEach((c) => {
      map[c.id] = `${c.firstName} ${c.lastName}`.trim()
    })
    return map
  }, [clients])

  const queue = useMemo(
    () => loans.filter((l) => PENDING_STATUSES.includes(l.status)),
    [loans],
  )

  const runApprove = async (approvalDate) => {
    setActionError(null)
    try {
      await approveAction.mutateAsync({ id: target.id, action: 'approve', value: approvalDate })
      setTarget(null)
    } catch (err) {
      setActionError(err)
    }
  }

  const columns = [
    {
      key: 'reference',
      label: 'Reference',
      render: (row) => (
        <div>
          <div className="fw-semibold">{row.referenceCode || `Loan #${row.id}`}</div>
          <div className="small text-body-secondary">
            {clientMap[row.clientId] || `Client #${row.clientId}`}
          </div>
        </div>
      ),
    },
    {
      key: 'amount',
      label: 'Principal',
      render: (row) => formatCurrency(row.principalAmount, row.currency),
    },
    {
      key: 'score',
      label: 'Risk',
      render: (row) =>
        row.creditScore ? (
          <span>
            {row.creditScore.riskScore ?? '—'}
            {row.creditScore.riskGrade ? ` · ${row.creditScore.riskGrade}` : ''}
          </span>
        ) : (
          <span className="text-body-secondary">—</span>
        ),
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
    {
      key: 'actions',
      label: '',
      headerClassName: 'text-end',
      className: 'text-end text-nowrap',
      render: (row) => (
        <CButton
          size="sm"
          color="primary"
          onClick={(e) => {
            e.stopPropagation()
            setActionError(null)
            setTarget(row)
          }}
        >
          <CIcon icon={cilCheckAlt} className="me-1" />
          Approve
        </CButton>
      ),
    },
  ]

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Approval Queue</strong>
        <CButton color="light" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <CIcon icon={cilReload} className="me-1" />
          Refresh
        </CButton>
      </CCardHeader>
      <CCardBody>
        <DataTable
          columns={columns}
          rows={queue}
          loading={isLoading}
          error={error}
          emptyMessage="No loans awaiting approval."
          onRowClick={(row) => navigate(`/loans/${row.id}`)}
        />
      </CCardBody>

      <LoanActionModal
        visible={Boolean(target)}
        action="approve"
        loading={approveAction.isPending}
        error={actionError}
        onConfirm={runApprove}
        onClose={() => setTarget(null)}
      />
    </CCard>
  )
}

export default LoanApprovals
