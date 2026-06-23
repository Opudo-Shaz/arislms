/**
 * MemberStatementModal
 *
 * Shows a member's contribution statement: total contributions, total
 * withdrawals, net balance, and the full record history.
 *
 * @module views/memberContributions/MemberStatementModal
 */

import React from 'react'
import PropTypes from 'prop-types'
import {
  CModal,
  CModalBody,
  CModalHeader,
  CModalTitle,
  CRow,
  CCol,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'

import StatusBadge from '../../components/StatusBadge'
import { useMemberStatement } from '../../hooks/useMemberContributions'
import { CONTRIBUTION_TYPE } from '../../constants/enums'
import { formatCurrency, formatDate } from '../../utils/format'

const Stat = ({ label, value, color }) => (
  <CCol xs={4} className="text-center">
    <div className="small text-body-secondary">{label}</div>
    <div className={`fs-5 fw-semibold ${color || ''}`}>{value}</div>
  </CCol>
)

Stat.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.node.isRequired,
  color: PropTypes.string,
}

const MemberStatementModal = ({ visible, clientId, onClose }) => {
  const { data, isLoading, error } = useMemberStatement(visible ? clientId : null)
  const client = data?.client
  const records = data?.records ?? []

  const title = client ? `${client.firstName} ${client.lastName}`.trim() : 'Member Statement'

  return (
    <CModal visible={visible} onClose={onClose} size="lg" alignment="center">
      <CModalHeader>
        <CModalTitle>{title}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {isLoading && <div className="text-center py-4 text-body-secondary">Loading…</div>}
        {!isLoading && error && (
          <div className="text-center py-4 text-danger">
            {error.message || 'Failed to load statement.'}
          </div>
        )}

        {!isLoading && !error && data && (
          <>
            <CRow className="mb-3">
              <Stat
                label="Contributions"
                value={formatCurrency(data.totalContributions)}
                color="text-success"
              />
              <Stat
                label="Withdrawals"
                value={formatCurrency(data.totalWithdrawals)}
                color="text-warning"
              />
              <Stat label="Net Balance" value={formatCurrency(data.netBalance)} />
            </CRow>

            <CTable small bordered responsive align="middle" className="mb-0">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Date</CTableHeaderCell>
                  <CTableHeaderCell>Type</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Amount</CTableHeaderCell>
                  <CTableHeaderCell>Notes</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {records.length === 0 && (
                  <CTableRow>
                    <CTableDataCell colSpan={4} className="text-center text-body-secondary py-4">
                      No records.
                    </CTableDataCell>
                  </CTableRow>
                )}
                {records.map((r) => (
                  <CTableRow key={r.id}>
                    <CTableDataCell>{formatDate(r.contributionDate)}</CTableDataCell>
                    <CTableDataCell>
                      <StatusBadge enumDef={CONTRIBUTION_TYPE} value={r.type} />
                    </CTableDataCell>
                    <CTableDataCell className="text-end">{formatCurrency(r.amount)}</CTableDataCell>
                    <CTableDataCell>{r.notes || '—'}</CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </>
        )}
      </CModalBody>
    </CModal>
  )
}

MemberStatementModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  clientId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onClose: PropTypes.func.isRequired,
}

MemberStatementModal.defaultProps = {
  clientId: null,
}

export default MemberStatementModal
