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
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CNav,
  CNavItem,
  CNavLink,
  CPopover,
  CRow,
  CSpinner,
  CTabContent,
  CTabPane,
} from '@coreui/react'
import FormSelect from '../../components/FormSelect'
import CIcon from '@coreui/icons-react'
import { cilBan, cilCash, cilCheckAlt, cilPencil, cilPlus, cilTrash, cilXCircle } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ScheduleTable from '../../components/loans/ScheduleTable'
import PaymentsTable from '../../components/loans/PaymentsTable'
import LoanActionModal from './LoanActionModal'
import LoanDocuments from './LoanDocuments'
import PaymentForm from '../payments/PaymentForm'
import PaymentDetailModal from '../payments/PaymentDetailModal'
import CollateralStatusModal from '../collaterals/CollateralStatusModal'
import CollateralEditModal from '../collaterals/CollateralEditModal'
import {
  useCoSignerConsent,
  useDeleteLoan,
  useLoan,
  useLoanAction,
  useResendCoSignerConsent,
  useWriteOffLoan,
} from '../../hooks/useLoans'
import { useLoanPayments } from '../../hooks/usePayments'
import { useLoanDocuments } from '../../hooks/useDocuments'
import { useUpdateCollateralStatus, useUpdateCollateralParticulars } from '../../hooks/useCollaterals'
import { useClient } from '../../hooks/useClients'
import { useLoanProduct } from '../../hooks/useLoanProducts'
import { useAuth } from '../../context/AuthContext'
import {
  CO_SIGNER_CONSENT_STATUS,
  LOAN_STATUS,
  COLLATERAL_STATUS,
  COLLATERAL_TYPE,
  LOAN_TRANSACTION_TYPE,
  TRANSACTION_DIRECTION,
  LOAN_DELETION_REASONS,
} from '../../constants/enums'
import { formatCurrency, formatDate, formatDateTime, formatPercent } from '../../utils/format'
import CreditScoreGauge from '../../components/CreditScoreGauge'
import toast from '../../utils/toast'

/** Statuses still awaiting an approval decision. */
const APPROVABLE = ['pending', 'pending_reverification', 'verified', 'in_review', 'under_review']
/** Statuses where the loan is finished/locked. */
const TERMINAL = ['closed', 'cancelled', 'deleted', 'rejected']
/** Statuses where a payment can be recorded against the loan. */
const PAYABLE = ['disbursed', 'active', 'partially_paid', 'overdue']
/** Statuses where a write-off can be executed. */
const WRITABLE_OFF = ['active', 'overdue', 'defaulted', 'partially_paid', 'partially_written_off']

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
  const { data: coSignerConsent } = useCoSignerConsent(id, Boolean(loan?.coSignerId && loan?.coSignerConsentStatus))
  const resendConsent = useResendCoSignerConsent(id)
  const { data: client } = useClient(loan?.clientId)
  const { data: loanProduct } = useLoanProduct(loan?.loanProductId)
  const { data: payments = [] } = useLoanPayments(id)
  const { data: loanDocuments = [] } = useLoanDocuments(id)
  const action = useLoanAction()
  const deleteMutation = useDeleteLoan()
  const writeOffMutation = useWriteOffLoan()
  const collateralStatusMutation = useUpdateCollateralStatus()
  const collateralEditMutation = useUpdateCollateralParticulars()
  const { hasPermission } = useAuth()
  const canRecordPayments = hasPermission('payments:create')
  const canApproveLoans = hasPermission('loans:approve')
  const canRejectLoans = hasPermission('loans:reject')
  const canDisburseLoans = hasPermission('loans:disburse')
  const canUpdateLoans = hasPermission('loans:update')
  const canDeleteLoans = hasPermission('loans:delete')
  const canWriteOffLoans = hasPermission('loans:write_off')
  const canEditCollateral = hasPermission('collaterals:update')
  const canManageCollateralStatus = hasPermission('collaterals:update_status')

  const [activeTab, setActiveTab] = useState(0)
  const [actionType, setActionType] = useState(null) // 'approve' | 'disburse' | 'principal' | 'reject'
  const [actionError, setActionError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteNotes, setDeleteNotes] = useState('')
  const [deleteTouched, setDeleteTouched] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [viewPayment, setViewPayment] = useState(null)
  const [collateralTarget, setCollateralTarget] = useState(null)
  const [collateralEditTarget, setCollateralEditTarget] = useState(null)

  const runAction = async (value) => {
    setActionError(null)
    try {
      if (actionType === 'write_off') {
        await writeOffMutation.mutateAsync({ id, payload: value })
      } else {
        await action.mutateAsync({ id, action: actionType, value })
      }
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

  const runCollateralEdit = async (data) => {
    try {
      await collateralEditMutation.mutateAsync({ id: collateralEditTarget.id, data, loanId: id })
      setCollateralEditTarget(null)
    } catch {
      // Error surfaced via mutation state; modal stays open.
    }
  }

  const runDelete = async () => {
    setDeleteTouched(true)
    if (!deleteReason) return
    setActionError(null)
    try {
      await deleteMutation.mutateAsync({ id, payload: { reason: deleteReason, notes: deleteNotes.trim() || undefined } })
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
  const canWriteOff = canWriteOffLoans && WRITABLE_OFF.includes(loan.status)
  const downPaymentRequired = Number(loan.downPaymentRequired || 0)
  const downPaymentPaid = Number(loan.downPaymentPaid || 0)
  const downPaymentDue = Math.max(0, Number((downPaymentRequired - downPaymentPaid).toFixed(2)))
  // Approved loans still owing a down payment can receive payments (collected as down payment).
  const canRecordPayment = PAYABLE.includes(loan.status) || (loan.status === 'approved' && downPaymentDue > 0)
  const schedules = (loan.repaymentSchedules || [])
    .slice()
    .sort((a, b) => a.installmentNumber - b.installmentNumber)
  const collaterals = loan.collaterals || []
  const transactions = (loan.transactions || [])
    .slice()
    .sort((a, b) => new Date(a.created_at || a.transactionDate) - new Date(b.created_at || b.transactionDate))

  /** Number of documents uploaded against each collateral id. */
  const docCountByCollateral = loanDocuments.reduce((acc, doc) => {
    if (doc.collateralId) acc[doc.collateralId] = (acc[doc.collateralId] || 0) + 1
    return acc
  }, {})

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
    {
      key: 'docCount',
      label: 'Docs',
      render: (r) => {
        const count = docCountByCollateral[r.id] || 0
        return count > 0
          ? <CBadge color="info">{count}</CBadge>
          : <span className="text-body-secondary">0</span>
      },
    },
    ...(canEditCollateral || canManageCollateralStatus
      ? [
          {
            key: 'actions',
            label: '',
            className: 'text-end',
            render: (r) => (
              <div className="d-flex gap-1 justify-content-end">
                {canEditCollateral && (
                  <CButton
                    color="secondary"
                    size="sm"
                    variant="outline"
                    onClick={() => setCollateralEditTarget(r)}
                    title="Edit collateral details"
                  >
                    <CIcon icon={cilPencil} />
                  </CButton>
                )}
                {canManageCollateralStatus && (
                  <CButton
                    color="warning"
                    size="sm"
                    variant="outline"
                    onClick={() => setCollateralTarget(r)}
                    title="Update status"
                  >
                    Status
                  </CButton>
                )}
              </div>
            ),
          },
        ]
      : []),
  ]

  const transactionColumns = [
    {
      key: 'transactionDate',
      label: 'Date',
      render: (r) => formatDateTime(r.created_at || r.transactionDate),
    },
    {
      key: 'transactionType',
      label: 'Type',
      render: (r) => <StatusBadge enumDef={LOAN_TRANSACTION_TYPE} value={r.transactionType} />,
    },
    {
      key: 'direction',
      label: 'Direction',
      render: (r) => <StatusBadge enumDef={TRANSACTION_DIRECTION} value={r.direction} />,
    },
    { key: 'amount', label: 'Amount', render: (r) => formatCurrency(r.amount, r.currency || loan.currency) },
    { key: 'totalBalance', label: 'Balance After', render: (r) => formatCurrency(r.totalBalance, r.currency || loan.currency) },
    { key: 'referenceType', label: 'Source', render: (r) => r.referenceType || '—' },
    {
      key: 'notes',
      label: 'Notes',
      render: (r) => {
        if (!r.notes) return '—'
        if (r.notes.length <= 20) return <span>{r.notes}</span>
        const truncated = r.notes.slice(0, 20) + '…'
        return (
          <CPopover
            content={r.notes}
            placement="top"
            trigger="focus"
            className="border border-primary"
          >
            <span
              role="button"
              tabIndex={0}
              style={{ cursor: 'pointer', borderBottom: '1px dotted currentColor', outline: 'none' }}
            >
              {truncated}
            </span>
          </CPopover>
        )
      },
    },
    {
      key: 'isReversed',
      label: 'Reversed?',
      render: (r) => r.isReversed ? <CBadge color="danger">yes</CBadge> : null,
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
            {canRecordPayments && canRecordPayment && (
              <CButton
                color="success"
                size="sm"
                onClick={() => setShowPaymentForm(true)}
              >
                <CIcon icon={cilPlus} className="me-1" />
                Record Payment
              </CButton>
            )}
            {canApproveLoans && canApprove && (
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
            {canRejectLoans && canApprove && (
              <CButton
                color="danger"
                size="sm"
                onClick={() => {
                  setActionError(null)
                  setActionType('reject')
                }}
              >
                <CIcon icon={cilBan} className="me-1" />
                Reject
              </CButton>
            )}
            {canDisburseLoans && canDisburse && (
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
            {canUpdateLoans && canEditPrincipal && (
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
            {canDeleteLoans && (
              <CButton
                color="danger"
                size="sm"
                variant="outline"
                onClick={() => {
                  setDeleteReason('')
                  setDeleteNotes('')
                  setDeleteTouched(false)
                  setConfirmDelete(true)
                }}
              >
                <CIcon icon={cilTrash} className="me-1" />
                Delete
              </CButton>
            )}
            {canWriteOff && (
              <CButton
                color="dark"
                size="sm"
                variant="outline"
                onClick={() => {
                  setActionError(null)
                  setActionType('write_off')
                }}
              >
                <CIcon icon={cilXCircle} className="me-1" />
                Write Off
              </CButton>
            )}
          </div>
        </CCardHeader>
        <CCardBody>
          {actionError && (
            <CAlert color="danger" dismissible onClose={() => setActionError(null)}>{actionError.message || 'Action failed.'}</CAlert>
          )}

          <CNav variant="tabs" role="tablist" className="mb-3">
            {['Overview', 'Repayment Schedule', 'Collaterals', 'Credit Score', 'Payments', 'Transactions', 'Documents'].map((label, idx) => (
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
                  {idx === 5 && transactions.length > 0 && (
                    <CBadge color="secondary" className="ms-2">
                      {transactions.length}
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
                <Field label="Outstanding Principal">
                  {formatCurrency(loan.outstandingBalance, loan.currency)}
                </Field>
                <Field label="Total Outstanding (incl. interest & penalties)">
                  {formatCurrency(
                    loan.totalOutstandingBalance ?? loan.outstandingBalance,
                    loan.currency,
                  )}
                </Field>
                <Field label="Interest Rate">
                  {formatPercent(loan.interestRate)} / {loan.interestRatePeriod === 'monthly' ? 'month' : 'year'}
                </Field>
                <Field label="Interest Type">{loan.interestType || '—'}</Field>
                <Field label="Term">{loan.termMonths ? `${loan.termMonths} months` : '—'}</Field>
                <Field label="Installment Amount">
                  {formatCurrency(loan.installmentAmount, loan.currency)}
                </Field>
                <Field label="Fees">{formatCurrency(loan.fees, loan.currency)}</Field>
                <Field label="Penalties">
                  <span className={Number(loan.penalties) > 0 ? 'text-danger fw-semibold' : undefined}>
                    {formatCurrency(loan.penalties, loan.currency)}
                  </span>
                </Field>
                <Field label="Down Payment Required">
                  {formatCurrency(loan.downPaymentRequired, loan.currency)}
                </Field>
                <Field label="Down Payment Paid">
                  {formatCurrency(loan.downPaymentPaid, loan.currency)}
                </Field>
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
                {loan.writtenOffAmount > 0 && (
                  <Field label="Written-Off Amount">
                    {formatCurrency(loan.writtenOffAmount, loan.currency)}
                  </Field>
                )}
                {loan.writtenOffDate && (
                  <Field label="Write-Off Date">{formatDate(loan.writtenOffDate)}</Field>
                )}
                {loan.coSignerId && (
                  <Field label="Co-signer">
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <Link to={`/clients/${loan.coSignerId}`}>
                        {loan.coSigner
                          ? `${loan.coSigner.firstName} ${loan.coSigner.lastName}`.trim()
                          : `Client #${loan.coSignerId}`}
                      </Link>
                      {loan.coSignerConsentStatus ? (
                        <StatusBadge enumDef={CO_SIGNER_CONSENT_STATUS} value={loan.coSignerConsentStatus} />
                      ) : (
                        <span className="small text-body-secondary" title="Loan predates consent tracking">consent not tracked</span>
                      )}
                      {canUpdateLoans && APPROVABLE.includes(loan.status) && loan.coSignerConsentStatus
                        && loan.coSignerConsentStatus !== 'accepted' && (
                        <CButton
                          color="secondary"
                          variant="outline"
                          size="sm"
                          disabled={resendConsent.isPending}
                          onClick={() =>
                            resendConsent.mutate(undefined, {
                              onSuccess: (res) => toast.success(`Consent link sent to ${(res?.sentTo || []).join(' / ') || 'the co-signer'}`),
                              onError: (err) => toast.error(err?.message || 'Could not resend the consent link'),
                            })
                          }
                        >
                          {resendConsent.isPending ? <CSpinner size="sm" /> : 'Resend consent link'}
                        </CButton>
                      )}
                    </div>
                    {coSignerConsent?.status === 'declined' && coSignerConsent.declineReason ? (
                      <div className="small text-body-secondary mt-1">Declined: {coSignerConsent.declineReason}</div>
                    ) : null}
                    {coSignerConsent?.status === 'pending' ? (
                      <div className="small text-body-secondary mt-1">Link expires {formatDateTime(coSignerConsent.expiresAt)}</div>
                    ) : null}
                  </Field>
                )}
              </CRow>
            </CTabPane>

            <CTabPane visible={activeTab === 1}>
              <ScheduleTable schedules={schedules} currency={loan.currency} />
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
                  <CCol xs={12} md={5} className="mb-3">
                    <CreditScoreGauge
                      score={score.riskScore}
                      grade={score.riskGrade}
                      creditLimit={score.creditLimit}
                      currency={loan.currency}
                      scoredAt={score.createdAt}
                    />
                  </CCol>
                  <CCol xs={12} md={7}>
                    <CRow>
                  <Field label="DTI">{score.riskDti ?? '—'}</Field>
                  <Field label="Model Version">{score.scoringModelVersion || '—'}</Field>
                  <Field label="Evaluated">{formatDate(score.createdAt)}</Field>
                  {score.notes && (
                    <CCol xs={12} className="mb-3">
                      <div className="text-body-secondary small">Notes</div>
                      <div>{score.notes}</div>
                    </CCol>
                  )}
                    </CRow>
                  </CCol>
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
              <PaymentsTable
                payments={payments}
                currency={loan.currency}
                onRowClick={(row) => setViewPayment(row)}
              />
            </CTabPane>

            <CTabPane visible={activeTab === 5}>
              <DataTable
                columns={transactionColumns}
                rows={transactions}
                emptyMessage="No transactions recorded for this loan yet."
              />
            </CTabPane>

            <CTabPane visible={activeTab === 6}>
              <LoanDocuments loanId={id} collaterals={collaterals} />
            </CTabPane>
          </CTabContent>
        </CCardBody>
      </CCard>

      <LoanActionModal
        visible={Boolean(actionType)}
        action={actionType}
        defaultValue={
          actionType === 'principal'
            ? loan.principalAmount
            : actionType === 'write_off'
              ? loan.outstandingBalance
              : undefined
        }
        loading={action.isPending || writeOffMutation.isPending}
        error={actionError}
        onConfirm={runAction}
        onClose={() => setActionType(null)}
      />

      <CModal visible={confirmDelete} onClose={() => setConfirmDelete(false)} alignment="center">
        <CModalHeader>
          <CModalTitle>Delete Loan</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p>
            {downPaymentPaid > 0 && !loan.disbursementDate
              ? `This loan has not been disbursed. The collected down payment (${formatCurrency(downPaymentPaid, loan.currency)}) will be transferred to the member's contributions.`
              : loan.disbursementDate
                ? `This loan has been disbursed. Its outstanding principal (${formatCurrency(loan.outstandingBalance, loan.currency)}) will be written off.`
                : 'Are you sure you want to delete this loan? This cannot be undone.'}
          </p>
          <CForm>
            <CFormLabel>Reason <span className="text-danger">*</span></CFormLabel>
            <FormSelect
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              invalid={deleteTouched && !deleteReason}
            >
              <option value="">Select a reason…</option>
              {LOAN_DELETION_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </FormSelect>
            {deleteTouched && !deleteReason && (
              <div className="invalid-feedback d-block">A reason is required.</div>
            )}
            <CFormLabel className="mt-3">Notes (optional)</CFormLabel>
            <CFormTextarea
              rows={2}
              value={deleteNotes}
              onChange={(e) => setDeleteNotes(e.target.value)}
            />
            {actionError && <CAlert color="danger" className="mt-3 mb-0">{actionError.message}</CAlert>}
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleteMutation.isPending}>
            Cancel
          </CButton>
          <CButton color="danger" onClick={runDelete} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending && <CSpinner size="sm" className="me-2" />}
            Delete
          </CButton>
        </CModalFooter>
      </CModal>

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

      <CollateralEditModal
        visible={Boolean(collateralEditTarget)}
        collateral={collateralEditTarget}
        loading={collateralEditMutation.isPending}
        error={collateralEditMutation.error}
        onConfirm={runCollateralEdit}
        onClose={() => setCollateralEditTarget(null)}
      />
    </>
  )
}

export default LoanDetail
