/**
 * Payments recorded against a loan. Shared by the staff LoanDetail and the
 * client portal's MyLoanDetail.
 *
 * @component
 */

import React from 'react'
import PropTypes from 'prop-types'
import DataTable from '../DataTable'
import StatusBadge from '../StatusBadge'
import { PAYMENT_STATUS, PAYMENT_METHOD, enumLabel } from '../../constants/enums'
import { formatCurrency, formatDateTime } from '../../utils/format'

const paymentColumns = (currency) => [
  { key: 'amount', label: 'Amount', render: (r) => formatCurrency(r.amount, r.currency || currency) },
  { key: 'externalRef', label: 'External Ref', render: (r) => r.externalRef || '—' },
  { key: 'method', label: 'Method', render: (r) => (r.method ? enumLabel(PAYMENT_METHOD, r.method) : '—') },
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

const PaymentsTable = ({
  payments = [],
  currency,
  loading,
  emptyMessage = 'No payments recorded for this loan yet.',
  onRowClick,
}) => (
  <DataTable
    columns={paymentColumns(currency)}
    rows={payments}
    loading={loading}
    emptyMessage={emptyMessage}
    onRowClick={onRowClick}
  />
)

PaymentsTable.propTypes = {
  payments: PropTypes.array,
  currency: PropTypes.string,
  loading: PropTypes.bool,
  emptyMessage: PropTypes.string,
  onRowClick: PropTypes.func,
}


export default PaymentsTable
