/**
 * Repayment schedule table for a loan. Shared by the staff LoanDetail and
 * the client portal's MyLoanDetail.
 *
 * @component
 */

import React from 'react'
import PropTypes from 'prop-types'
import DataTable from '../DataTable'
import StatusBadge from '../StatusBadge'
import { REPAYMENT_SCHEDULE_STATUS } from '../../constants/enums'
import { formatCurrency, formatDate } from '../../utils/format'

const scheduleColumns = (currency) => [
  {
    key: 'installmentNumber',
    label: '#',
    render: (r) =>
      r.installmentNumber === 0
        ? Number(r.feesAmount) > 0
          ? 'Fee'
          : 'Down Pmt'
        : r.installmentNumber,
  },
  { key: 'dueDate', label: 'Due', render: (r) => formatDate(r.dueDate) },
  { key: 'principalAmount', label: 'Principal', render: (r) => formatCurrency(r.principalAmount, currency) },
  { key: 'interestAmount', label: 'Interest', render: (r) => formatCurrency(r.interestAmount, currency) },
  { key: 'feesAmount', label: 'Fees', render: (r) => formatCurrency(r.feesAmount, currency) },
  {
    key: 'penaltyAmount',
    label: 'Penalty',
    render: (r) =>
      Number(r.penaltyAmount) > 0 ? (
        <span className="text-danger fw-semibold">{formatCurrency(r.penaltyAmount, currency)}</span>
      ) : (
        formatCurrency(0, currency)
      ),
  },
  {
    key: 'totalAmount',
    label: 'Total',
    render: (r) => formatCurrency(Number(r.totalAmount) + Number(r.penaltyAmount || 0), currency),
  },
  { key: 'paidAmount', label: 'Paid', render: (r) => formatCurrency(r.paidAmount, currency) },
  {
    key: 'status',
    label: 'Status',
    render: (r) => <StatusBadge enumDef={REPAYMENT_SCHEDULE_STATUS} value={r.status} />,
  },
]

const ScheduleTable = ({
  schedules = [],
  currency,
  loading,
  emptyMessage = 'No repayment schedule yet. It is generated on disbursement.',
}) => (
  <DataTable
    columns={scheduleColumns(currency)}
    rows={schedules}
    loading={loading}
    emptyMessage={emptyMessage}
  />
)

ScheduleTable.propTypes = {
  schedules: PropTypes.array,
  currency: PropTypes.string,
  loading: PropTypes.bool,
  emptyMessage: PropTypes.string,
}


export default ScheduleTable
