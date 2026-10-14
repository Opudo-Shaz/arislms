/**
 * Staff: review queue for payments clients reported through the portal
 * (temporary until M-Pesa integration).
 *
 * Reviewers (payment_reports:review) check each report against the
 * paybill/bank statement, correct details if needed (the client's original
 * submission stays visible), then apply it — which records a real loan
 * repayment — or reject it with a reason the client is told.
 *
 * @component
 */

import React, { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilReload } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import CursorPager from '../../components/CursorPager'
import StatusBadge from '../../components/StatusBadge'
import ConfirmModal from '../../components/ConfirmModal'
import { usePaymentReports, usePaymentReportAction } from '../../hooks/usePaymentReports'
import { useCursorPagination } from '../../hooks/useCursorPagination'
import { useAuth } from '../../context/AuthContext'
import { PAYMENT_METHOD, PAYMENT_REPORT_REVIEW_STATUS, enumLabel } from '../../constants/enums'
import { formatCurrency, formatDateTime } from '../../utils/format'
import toast from '../../utils/toast'

const PAGE_SIZE = 15
const AMENDABLE = ['amount', 'externalRef', 'transactionDate', 'paymentMethod', 'payerPhone', 'notes']

const toLocalInput = (value) => {
  if (!value) return ''
  const d = new Date(value)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

const clientName = (r) => (r.client ? `${r.client.firstName} ${r.client.lastName}` : `Client #${r.clientId}`)

/** Shows "original → amended" when a reviewer changed a field. */
const sameValue = (a, b) =>
  String(a) === String(b) || (a !== '' && b !== '' && !Number.isNaN(Number(a)) && Number(a) === Number(b))

const Changed = ({ original, current, format = (v) => v }) => {
  if (original === undefined || original === null || sameValue(original, current)) return format(current)
  return (
    <span>
      <span className="text-decoration-line-through text-body-secondary me-1">{format(original)}</span>
      {format(current)}
    </span>
  )
}

const ReviewModal = ({ report, canReview, onClose }) => {
  const action = usePaymentReportAction()
  const original = report.originalSubmission || {}
  const [form, setForm] = useState(() => ({
    amount: report.amount,
    externalRef: report.externalRef,
    transactionDate: toLocalInput(report.transactionDate),
    paymentMethod: report.paymentMethod,
    payerPhone: report.payerPhone || '',
    notes: report.notes || '',
  }))
  const [confirm, setConfirm] = useState(null) // 'apply' | 'reject'
  const [error, setError] = useState(null)
  const editable = canReview && report.status === 'pending'

  const changes = () => {
    const out = {}
    AMENDABLE.forEach((k) => {
      let v = form[k]
      let prev = report[k]
      if (k === 'transactionDate') {
        v = v ? new Date(v).toISOString() : null
        prev = report.transactionDate ? new Date(report.transactionDate).toISOString() : null
      }
      if (k === 'amount') {
        v = Number(v)
        prev = Number(prev)
      }
      if ((v ?? '') !== (prev ?? '')) out[k] = v === '' ? null : v
    })
    return out
  }
  const pending = changes()
  const hasChanges = Object.keys(pending).length > 0

  const run = async (kind, payload) => {
    setError(null)
    try {
      await action.mutateAsync({ action: kind, id: report.id, payload })
      return true
    } catch (err) {
      const fieldErrors = err?.data?.errors
      setError(fieldErrors?.length ? fieldErrors.map((f) => f.message).join(' ') : err?.message || 'Action failed')
      return false
    }
  }

  const saveChanges = async () => {
    if (await run('amend', pending)) toast.success('Report updated')
  }

  const doApply = async (notes) => {
    // Persist any unsaved corrections first so the payment is recorded with them.
    if (hasChanges && !(await run('amend', pending))) return setConfirm(null)
    if (await run('apply', notes || undefined)) {
      toast.success('Payment applied to the loan')
      onClose()
    }
    setConfirm(null)
  }

  const doReject = async (reason) => {
    if (await run('reject', reason)) {
      toast.success('Report rejected — the client has been notified')
      onClose()
    }
    setConfirm(null)
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: k === 'externalRef' ? e.target.value.toUpperCase() : e.target.value }))

  return (
    <>
      <CModal visible size="lg" onClose={onClose} alignment="center">
        <CModalHeader>
          <CModalTitle>Reported payment #{report.id}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error ? <CAlert color="danger" dismissible onClose={() => setError(null)}>{error}</CAlert> : null}
          <CRow className="mb-3 small">
            <CCol sm={6}>
              <div className="text-body-secondary">Client</div>
              <div className="fw-semibold">
                <Link to={`/clients/${report.clientId}`}>{clientName(report)}</Link>
                {report.client?.accountNumber ? <span className="text-body-secondary ms-1">({report.client.accountNumber})</span> : null}
              </div>
              <div>{report.client?.phone}</div>
            </CCol>
            <CCol sm={6}>
              <div className="text-body-secondary">Loan</div>
              <div className="fw-semibold">
                <Link to={`/loans/${report.loanId}`}>{report.loan?.referenceCode || `#${report.loanId}`}</Link>
              </div>
              <div>
                {report.loan ? <>Status {report.loan.status} · balance {formatCurrency(report.loan.outstandingBalance, report.loan.currency)}</> : null}
              </div>
            </CCol>
          </CRow>

          {editable ? (
            <CForm>
              <CRow className="g-3">
                <CCol md={4}>
                  <CFormLabel htmlFor="pr-amount">Amount ({report.currency})</CFormLabel>
                  <CFormInput id="pr-amount" type="number" step="0.01" min="0.01" value={form.amount} onChange={set('amount')} />
                  {Number(original.amount) !== Number(form.amount) ? (
                    <div className="form-text">Client reported {formatCurrency(original.amount, report.currency)}</div>
                  ) : null}
                </CCol>
                <CCol md={4}>
                  <CFormLabel htmlFor="pr-ref">Transaction ref</CFormLabel>
                  <CFormInput id="pr-ref" value={form.externalRef} onChange={set('externalRef')} />
                  {original.externalRef && original.externalRef !== form.externalRef ? (
                    <div className="form-text">Client reported {original.externalRef}</div>
                  ) : null}
                </CCol>
                <CCol md={4}>
                  <CFormLabel htmlFor="pr-date">Paid at</CFormLabel>
                  <CFormInput id="pr-date" type="datetime-local" value={form.transactionDate} onChange={set('transactionDate')} />
                </CCol>
                <CCol md={4}>
                  <CFormLabel htmlFor="pr-method">Method</CFormLabel>
                  <CFormSelect id="pr-method" value={form.paymentMethod} onChange={set('paymentMethod')}>
                    {PAYMENT_METHOD.values.map((v) => <option key={v} value={v}>{PAYMENT_METHOD.labels[v]}</option>)}
                  </CFormSelect>
                </CCol>
                <CCol md={4}>
                  <CFormLabel htmlFor="pr-phone">Payer phone</CFormLabel>
                  <CFormInput id="pr-phone" value={form.payerPhone} onChange={set('payerPhone')} />
                </CCol>
                <CCol md={12}>
                  <CFormLabel htmlFor="pr-notes">Notes</CFormLabel>
                  <CFormTextarea id="pr-notes" rows={2} value={form.notes} onChange={set('notes')} />
                </CCol>
              </CRow>
            </CForm>
          ) : (
            <dl className="row mb-0">
              <dt className="col-sm-4 text-body-secondary fw-normal">Amount</dt>
              <dd className="col-sm-8"><Changed original={original.amount} current={report.amount} format={(v) => formatCurrency(v, report.currency)} /></dd>
              <dt className="col-sm-4 text-body-secondary fw-normal">Reference</dt>
              <dd className="col-sm-8"><Changed original={original.externalRef} current={report.externalRef} /></dd>
              <dt className="col-sm-4 text-body-secondary fw-normal">Paid at</dt>
              <dd className="col-sm-8">{formatDateTime(report.transactionDate)}</dd>
              <dt className="col-sm-4 text-body-secondary fw-normal">Method</dt>
              <dd className="col-sm-8">{enumLabel(PAYMENT_METHOD, report.paymentMethod)}</dd>
              <dt className="col-sm-4 text-body-secondary fw-normal">Status</dt>
              <dd className="col-sm-8"><StatusBadge enumDef={PAYMENT_REPORT_REVIEW_STATUS} value={report.status} /></dd>
              {report.reviewer ? (
                <>
                  <dt className="col-sm-4 text-body-secondary fw-normal">Reviewed by</dt>
                  <dd className="col-sm-8">{report.reviewer.name} · {formatDateTime(report.reviewedAt)}</dd>
                </>
              ) : null}
              {report.reviewNotes ? (
                <>
                  <dt className="col-sm-4 text-body-secondary fw-normal">Review notes</dt>
                  <dd className="col-sm-8">{report.reviewNotes}</dd>
                </>
              ) : null}
              {report.paymentId ? (
                <>
                  <dt className="col-sm-4 text-body-secondary fw-normal">Payment</dt>
                  <dd className="col-sm-8">Recorded as payment #{report.paymentId}</dd>
                </>
              ) : null}
            </dl>
          )}
        </CModalBody>
        <CModalFooter>
          {editable ? (
            <>
              <CButton color="danger" variant="outline" className="me-auto" onClick={() => setConfirm('reject')} disabled={action.isPending}>
                Reject
              </CButton>
              <CButton color="secondary" variant="outline" onClick={saveChanges} disabled={!hasChanges || action.isPending}>
                {action.isPending && !confirm ? <CSpinner size="sm" /> : 'Save changes'}
              </CButton>
              <CButton color="success" onClick={() => setConfirm('apply')} disabled={action.isPending}>
                {hasChanges ? 'Save & apply' : 'Apply payment'}
              </CButton>
            </>
          ) : (
            <CButton color="secondary" variant="outline" onClick={onClose}>Close</CButton>
          )}
        </CModalFooter>
      </CModal>

      <ConfirmModal
        visible={confirm === 'apply'}
        title="Apply this payment?"
        body={
          <p className="mb-0">
            This records a repayment of <strong>{formatCurrency(form.amount, report.currency)}</strong> (ref{' '}
            <strong>{form.externalRef}</strong>) on loan {report.loan?.referenceCode}. Make sure it matches the statement.
          </p>
        }
        confirmText="Apply payment"
        confirmColor="success"
        loading={action.isPending}
        withNotes
        notesLabel="Review notes"
        onConfirm={doApply}
        onClose={() => setConfirm(null)}
      />
      <ConfirmModal
        visible={confirm === 'reject'}
        title="Reject this report?"
        body={<p className="mb-0">The client will be told the payment could not be confirmed, with your reason.</p>}
        confirmText="Reject"
        confirmColor="danger"
        loading={action.isPending}
        withNotes
        notesLabel="Reason (shared with the client)"
        notesRequired
        onConfirm={doReject}
        onClose={() => setConfirm(null)}
      />
    </>
  )
}

const PaymentReports = () => {
  const { hasPermission } = useAuth()
  const canRead = hasPermission('payment_reports:read')
  const canReview = hasPermission('payment_reports:review')

  const [status, setStatus] = useState('pending')
  const [selected, setSelected] = useState(null)
  const filters = { status: status || undefined }
  const { cursorParams, goTo } = useCursorPagination(filters)
  const { data, isLoading, error, refetch, isFetching } = usePaymentReports({ ...filters, ...cursorParams, limit: PAGE_SIZE })
  const reports = data?.reports ?? []

  if (!canRead) return <Navigate to="/unauthorized" replace />

  const columns = [
    { key: 'reported', label: 'Reported', render: (r) => formatDateTime(r.createdAt) },
    {
      key: 'client',
      label: 'Client / loan',
      render: (r) => (
        <div>
          <div className="fw-semibold">{clientName(r)}</div>
          <div className="small text-body-secondary">{r.loan?.referenceCode}</div>
        </div>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (r) => <Changed original={r.originalSubmission?.amount} current={r.amount} format={(v) => formatCurrency(v, r.currency)} />,
    },
    {
      key: 'ref',
      label: 'Reference',
      render: (r) => (
        <div>
          <Changed original={r.originalSubmission?.externalRef} current={r.externalRef} />
          <div className="small text-body-secondary">{enumLabel(PAYMENT_METHOD, r.paymentMethod)} · {formatDateTime(r.transactionDate)}</div>
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge enumDef={PAYMENT_REPORT_REVIEW_STATUS} value={r.status} /> },
  ]

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex align-items-center">
        <strong>Client-reported payments</strong>
        <CButton color="light" size="sm" className="ms-auto" onClick={() => refetch()} disabled={isFetching}>
          <CIcon icon={cilReload} className="me-1" />
          Refresh
        </CButton>
      </CCardHeader>
      <CCardBody>
        <p className="small text-body-secondary">
          Payments clients say they made manually (e.g. M-Pesa paybill). Match each against the statement, correct any details,
          then apply it to record the repayment — or reject it with a reason.
        </p>
        <CRow className="mb-3">
          <CCol sm={6} md={4}>
            <CFormSelect aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              {PAYMENT_REPORT_REVIEW_STATUS.values.map((v) => (
                <option key={v} value={v}>{PAYMENT_REPORT_REVIEW_STATUS.labels[v]}</option>
              ))}
            </CFormSelect>
          </CCol>
        </CRow>
        <DataTable
          columns={columns}
          rows={reports}
          loading={isLoading}
          error={error}
          emptyMessage={status === 'pending' ? 'No payments are waiting for confirmation.' : 'No reports match this filter.'}
          onRowClick={(row) => setSelected(row)}
        />
        <CursorPager
          pagination={data?.pagination}
          onNavigate={goTo}
          disabled={isFetching}
          summary={`Showing ${reports.length} report${reports.length === 1 ? '' : 's'}`}
        />
      </CCardBody>
      {selected ? (
        <ReviewModal key={selected.id} report={selected} canReview={canReview} onClose={() => setSelected(null)} />
      ) : null}
    </CCard>
  )
}

export default PaymentReports
