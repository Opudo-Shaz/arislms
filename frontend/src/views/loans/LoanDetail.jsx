/**
 * LoanDetail
 *
 * Loan overview with tabbed sections (Overview, Repayment Schedule,
 * Collaterals, Credit Score) and lifecycle actions (approve, disburse,
 * update principal, delete). Schedule, collaterals, and credit score are
 * embedded in the loan detail response.
 *
 * @module views/loans/LoanDetail
 */

import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CSpinner,
  CTabContent,
  CTabPane,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCash, cilCheckAlt, cilPencil, cilPlus, cilTrash } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ConfirmModal from '../../components/ConfirmModal'
import LoanActionModal from './LoanActionModal'
import LoanDocuments from './LoanDocuments'
import PaymentForm from '../payments/PaymentForm'
import PaymentDetailModal from '../payments/PaymentDetailModal'
import CollateralStatusModal from '../collaterals/CollateralStatusModal'
import { useLoan, useLoanAction, useDeleteLoan } from '../../hooks/useLoans'
import { useLoanPayments } from '../../hooks/usePayments'
import { useUpdateCollateralStatus } from '../../hooks/useCollaterals'
import { useClient } from '../../hooks/useClients'
import { useLoanProduct } from '../../hooks/useLoanProducts'
import { useAuth } from '../../context/AuthContext'
import {
  LOAN_STATUS,
  COLLATERAL_STATUS,
  COLLATERAL_TYPE,
  REPAYMENT_SCHEDULE_STATUS,
  PAYMENT_STATUS,
  ROLES,
} from '../../constants/enums'
import { formatCurrency, formatDate, formatDateTime, formatPercent } from '../../utils/format'

/** Statuses still awaiting an approval decision. */
const APPROVABLE = ['pending', 'pending_reverification', 'verified', 'in_review', 'under_review']
/** Statuses where the loan is finished/locked. */
const TERMINAL = ['closed', 'cancelled', 'deleted', 'rejected']
/** Statuses where a payment can be recorded against the loan. */
const PAYABLE = ['disbursed', 'active', 'partially_paid', 'overdue']

const Field = ({ label, children }) => (
  <CCol md={6} className="mb-3">
    <div className="text-body-secondary small">{label}</div>
    <div>{children ?? '—'}</div>
  </CCol>
)

const LoanDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: loan, isLoading, error } = useLoan(id)
  const { data: client } = useClient(loan?.clientId)
  const { data: loanProduct } = useLoanProduct(loan?.loanProductId)
  const { data: payments = [] } = useLoanPayments(id)
  const action = useLoanAction()
  const deleteMutation = useDeleteLoan()
  const collateralStatusMutation = useUpdateCollateralStatus()
  const { role } = useAuth()
  const isAdmin = role === ROLES.ADMIN

  const [activeTab, setActiveTab] = useState(0)
  const [actionType, setActionType] = useState(null) // 'approve' | 'disburse' | 'principal'
  const [actionError, setActionError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [viewPayment, setViewPayment] = useState(null)
  const [collateralTarget, setCollateralTarget] = useState(null)

  const runAction = async (value) => {
    setActionError(null)
    try {
      await action.mutateAsync({ id, action: actionType, value })
      setActionType(null)
    } catch (err) {
      setActionError(err)
    }
  }

  const runCollateralStatus = async (status, notes) => {
    try {
      await collateralStatusMutation.mutateAsync({ id: collateralTarget.id, status, notes, loanId: id })
      setCollateralTarget(null)
    } catch {
      // Error surfaced via mutation state; modal stays open.
    }
  }

  const runDelete = async () => {
    setActionError(null)
    try {
      await deleteMutation.mutateAsync(id)
      navigate('/loans')
    } catch (err) {
      setActionError(err)
      setConfirmDelete(false)
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )
  }

  if (error || !loan) {
    return <CAlert color="danger">{error?.message || 'Loan not found.'}</CAlert>
  }

  const canApprove = APPROVABLE.includes(loan.status)
  const canDisburse = loan.status === 'approved'
  const canEditPrincipal = !TERMINAL.includes(loan.status) && loan.status !== 'active'
  const canRecordPayment = PAYABLE.includes(loan.status)
  const schedules = (loan.repaymentSchedules || [])
    .slice()
    .sort((a, b) => a.installmentNumber - b.installmentNumber)
  const collaterals = loan.collaterals || []

  const scheduleColumns = [
    { key: 'installmentNumber', label: '#', render: (r) => r.installmentNumber },
    { key: 'dueDate', label: 'Due', render: (r) => formatDate(r.dueDate) },
    { key: 'principalAmount', label: 'Principal', render: (r) => formatCurrency(r.principalAmount, loan.currency) },
    { key: 'interestAmount', label: 'Interest', render: (r) => formatCurrency(r.interestAmount, loan.currency) },
    { key: 'totalAmount', label: 'Total', render: (r) => formatCurrency(r.totalAmount, loan.currency) },
    { key: 'paidAmount', label: 'Paid', render: (r) => formatCurrency(r.paidAmount, loan.currency) },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge enumDef={REPAYMENT_SCHEDULE_STATUS} value={r.status} />,
    },
  ]

  const collateralColumns = [
    {
      key: 'type',
      label: 'Type',
      render: (r) => <StatusBadge enumDef={COLLATERAL_TYPE} value={r.collateralType} />,
    },
    { key: 'description', label: 'Description', render: (r) => r.description || '—' },
    {
      key: 'reference',
      label: 'Reference',
      render: (r) => r.registrationNumber || r.referenceNumber || '—',
    },
    {
      key: 'estimatedValue',
      label: 'Est. Value',
      render: (r) => formatCurrency(r.estimatedValue, loan.currency),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge enumDef={COLLATERAL_STATUS} value={r.status} />,
    },
    ...(isAdmin
      ? [
          {
            key: 'actions',
            label: '',
            className: 'text-end',
            render: (r) => (
              <CButton
                color="warning"
                size="sm"
                variant="outline"
                onClick={() => setCollateralTarget(r)}
              >
                <CIcon icon={cilPencil} className="me-1" />
                Status
              </CButton>
            ),
          },
        ]
      : []),
  ]

  const paymentColumns = [
    { key: 'amount', label: 'Amount', render: (r) => formatCurrency(r.amount, loan.currency) },
    { key: 'externalRef', label: 'External Ref', render: (r) => r.externalRef || '—' },
    { key: 'method', label: 'Method', render: (r) => r.method || '—' },
    {
      key: 'transactionDate',
      label: 'Date',
      render: (r) => formatDateTime(r.paymentDate || r.transactionDate),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge enumDef={PAYMENT_STATUS} value={r.status} />,
    },
  ]

  const score = loan.creditScore

  return (
    <>
      <CCard className="mb-4">
        <CCardHeader className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <strong>{loan.referenceCode || `Loan #${loan.id}`}</strong>{' '}
            <StatusBadge enumDef={LOAN_STATUS} value={loan.status} />
            <div className="small text-body-secondary mt-1">
              {client ? (
                <a
                  href={`/clients/${loan.clientId}`}
                  onClick={(e) => {
                    e.preventDefault()
                    navigate(`/clients/${loan.clientId}`)
                  }}
                >
                  {client.firstName} {client.lastName}
                </a>
              ) : (
                `Client #${loan.clientId}`
              )}
            </div>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            {canRecordPayment && (
              <CButton
                color="success"
                size="sm"
                onClick={() => setShowPaymentForm(true)}
              >
                <CIcon icon={cilPlus} className="me-1" />
                Record Payment
              </CButton>
            )}
            {canApprove && (
              <CButton
                color="primary"
                size="sm"
                onClick={() => {
                  setActionError(null)
                  setActionType('approve')
                }}
              >
                <CIcon icon={cilCheckAlt} className="me-1" />
                Approve
              </CButton>
            )}
            {canDisburse && (
              <CButton
                color="success"
                size="sm"
                onClick={() => {
                  setActionError(null)
                  setActionType('disburse')
                }}
              >
                <CIcon icon={cilCash} className="me-1" />
                Disburse
              </CButton>
            )}
            {canEditPrincipal && (
              <CButton
                color="warning"
                size="sm"
                variant="outline"
                onClick={() => {
                  setActionError(null)
                  setActionType('principal')
                }}
              >
                <CIcon icon={cilPencil} className="me-1" />
                Principal
              </CButton>
            )}
            <CButton
              color="danger"
              size="sm"
              variant="outline"
              onClick={() => setConfirmDelete(true)}
            >
              <CIcon icon={cilTrash} className="me-1" />
              Delete
            </CButton>
          </div>
        </CCardHeader>
        <CCardBody>
          {actionError && (
            <CAlert color="danger" dismissible onClose={() => setActionError(null)}>{actionError.message || 'Action failed.'}</CAlert>
          )}

          <CNav variant="tabs" role="tablist" className="mb-3">
            {['Overview', 'Repayment Schedule', 'Collaterals', 'Credit Score', 'Payments', 'Documents'].map((label, idx) => (
              <CNavItem key={label}>
                <CNavLink active={activeTab === idx} onClick={() => setActiveTab(idx)} role="button">
                  {label}
                  {idx === 1 && schedules.length > 0 && (
                    <CBadge color="secondary" className="ms-2">
                      {schedules.length}
                    </CBadge>
                  )}
                  {idx === 2 && collaterals.length > 0 && (
                    <CBadge color="secondary" className="ms-2">
                      {collaterals.length}
                    </CBadge>
                  )}
                  {idx === 4 && payments.length > 0 && (
                    <CBadge color="secondary" className="ms-2">
                      {payments.length}
                    </CBadge>
                  )}
                </CNavLink>
              </CNavItem>
            ))}
          </CNav>

          <CTabContent>
            <CTabPane visible={activeTab === 0}>
              <CRow>
                <Field label="Loan Product">
                  {loanProduct ? loanProduct.name : `Product #${loan.loanProductId}`}
                </Field>
                <Field label="Principal Amount">
                  {formatCurrency(loan.principalAmount, loan.currency)}
                </Field>
                <Field label="Outstanding Balance">
                  {formatCurrency(loan.outstandingBalance, loan.currency)}
                </Field>
                <Field label="Interest Rate">{formatPercent(loan.interestRate)}</Field>
                <Field label="Interest Type">{loan.interestType || '—'}</Field>
                <Field label="Term">{loan.termMonths ? `${loan.termMonths} months` : '—'}</Field>
                <Field label="Installment Amount">
                  {formatCurrency(loan.installmentAmount, loan.currency)}
                </Field>
                <Field label="Fees">{formatCurrency(loan.fees, loan.currency)}</Field>
                <Field label="Penalties">{formatCurrency(loan.penalties, loan.currency)}</Field>
                <Field label="Start Date">{formatDate(loan.startDate)}</Field>
                <Field label="End Date">{formatDate(loan.endDate)}</Field>
                <Field label="Approval Date">{formatDate(loan.approvalDate)}</Field>
                <Field label="Disbursement Date">{formatDate(loan.disbursementDate)}</Field>
                {loan.approvalDate && (
                  <Field label="Approved By">{loan.approvedBy || '—'}</Field>
                )}
                {loan.disbursementDate && (
                  <Field label="Disbursed By">{loan.disbursedBy || '—'}</Field>
                )}
                <Field label="Total Repaid">
                  {formatCurrency(loan.amountRepaid, loan.currency)}
                </Field>
                <Field label="Repayments Made">{loan.noOfRepayments ?? '—'}</Field>
              </CRow>
            </CTabPane>

            <CTabPane visible={activeTab === 1}>
              <DataTable
                columns={scheduleColumns}
                rows={schedules}
                emptyMessage="No repayment schedule yet. It is generated on disbursement."
              />
            </CTabPane>

            <CTabPane visible={activeTab === 2}>
              <DataTable
                columns={collateralColumns}
                rows={collaterals}
                emptyMessage="No collateral recorded for this loan."
              />
            </CTabPane>

            <CTabPane visible={activeTab === 3}>
              {score ? (
                <CRow>
                  <Field label="Risk Score">{score.riskScore ?? '—'}</Field>
                  <Field label="Risk Grade">
                    {score.riskGrade ? <CBadge color="info">Grade {score.riskGrade}</CBadge> : '—'}
                  </Field>
                  <Field label="DTI">{score.riskDti ?? '—'}</Field>
                  <Field label="Credit Limit">{formatCurrency(score.creditLimit, loan.currency)}</Field>
                  <Field label="Model Version">{score.scoringModelVersion || '—'}</Field>
                  <Field label="Evaluated">{formatDate(score.createdAt)}</Field>
                  {score.notes && (
                    <CCol xs={12} className="mb-3">
                      <div className="text-body-secondary small">Notes</div>
                      <div>{score.notes}</div>
                    </CCol>
                  )}
                </CRow>
              ) : (
                <div className="text-body-secondary py-3">
                  No credit score recorded for this loan.
                </div>
              )}
            </CTabPane>

            <CTabPane visible={activeTab === 4}>
              <div className="d-flex justify-content-end mb-3">
                {canRecordPayment && (
                  <CButton color="success" size="sm" onClick={() => setShowPaymentForm(true)}>
                    <CIcon icon={cilPlus} className="me-1" />
                    Record Payment
                  </CButton>
                )}
              </div>
              <DataTable
                columns={paymentColumns}
                rows={payments}
                emptyMessage="No payments recorded for this loan yet."
                onRowClick={(row) => setViewPayment(row)}
              />
            </CTabPane>

            <CTabPane visible={activeTab === 5}>
              <LoanDocuments loanId={id} />
            </CTabPane>
          </CTabContent>
        </CCardBody>
      </CCard>

      <LoanActionModal
        visible={Boolean(actionType)}
        action={actionType}
        defaultValue={actionType === 'principal' ? loan.principalAmount : undefined}
        loading={action.isPending}
        error={actionError}
        onConfirm={runAction}
        onClose={() => setActionType(null)}
      />

      <ConfirmModal
        visible={confirmDelete}
        title="Delete Loan"
        body="Are you sure you want to delete this loan? This cannot be undone."
        confirmText="Delete"
        confirmColor="danger"
        loading={deleteMutation.isPending}
        onConfirm={runDelete}
        onClose={() => setConfirmDelete(false)}
      />

      <PaymentForm
        visible={showPaymentForm}
        loan={loan}
        onClose={() => setShowPaymentForm(false)}
      />

      <PaymentDetailModal
        visible={Boolean(viewPayment)}
        payment={viewPayment}
        loanLabel={loan.referenceCode || `Loan #${loan.id}`}
        clientLabel={client ? `${client.firstName} ${client.lastName}`.trim() : `Client #${loan.clientId}`}
        onClose={() => setViewPayment(null)}
      />

      <CollateralStatusModal
        visible={Boolean(collateralTarget)}
        collateral={collateralTarget}
        loading={collateralStatusMutation.isPending}
        error={collateralStatusMutation.error}
        onConfirm={runCollateralStatus}
        onClose={() => setCollateralTarget(null)}
      />
    </>
  )
}

export default LoanDetail
