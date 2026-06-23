/**
 * JournalEntryDetailModal
 *
 * Read-only view of a single journal entry and its debit/credit lines.
 *
 * @module views/accounting/JournalEntryDetailModal
 */

import React from 'react'
import PropTypes from 'prop-types'
import {
  CModal,
  CModalBody,
  CModalHeader,
  CModalTitle,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableFoot,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'

import StatusBadge from '../../components/StatusBadge'
import { JOURNAL_ENTRY_STATUS, LEDGER_SOURCE_TYPE } from '../../constants/enums'
import { formatCurrency, formatDateTime } from '../../utils/format'

const Detail = ({ label, children }) => (
  <div className="mb-2">
    <div className="small text-body-secondary">{label}</div>
    <div>{children}</div>
  </div>
)

Detail.propTypes = { label: PropTypes.string.isRequired, children: PropTypes.node }

const JournalEntryDetailModal = ({ visible, entry, onClose }) => {
  const lines = entry?.lines || []
  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0)

  return (
    <CModal visible={visible} onClose={onClose} size="lg" alignment="center">
      <CModalHeader>
        <CModalTitle>{entry ? entry.reference : 'Journal Entry'}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {entry && (
          <>
            <div className="d-flex flex-wrap gap-4 mb-3">
              <Detail label="Date">{formatDateTime(entry.createdAt || entry.entryDate)}</Detail>
              <Detail label="Status">
                <StatusBadge enumDef={JOURNAL_ENTRY_STATUS} value={entry.status} />
              </Detail>
              <Detail label="Source">
                <StatusBadge enumDef={LEDGER_SOURCE_TYPE} value={entry.sourceType} />
              </Detail>
              {entry.sourceId != null && <Detail label="Source ID">{entry.sourceId}</Detail>}
              {entry.reversalOfId != null && (
                <Detail label="Reversal of">#{entry.reversalOfId}</Detail>
              )}
            </div>

            {entry.description && <Detail label="Description">{entry.description}</Detail>}

            <CTable small bordered responsive align="middle" className="mt-3 mb-0">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Account</CTableHeaderCell>
                  <CTableHeaderCell>Description</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Debit</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Credit</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {lines.map((l) => (
                  <CTableRow key={l.id}>
                    <CTableDataCell>
                      <div className="fw-semibold">{l.accountCode || '—'}</div>
                      <div className="small text-body-secondary">{l.accountName || ''}</div>
                    </CTableDataCell>
                    <CTableDataCell>{l.description || '—'}</CTableDataCell>
                    <CTableDataCell className="text-end">
                      {Number(l.debit) ? formatCurrency(l.debit) : '—'}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
                      {Number(l.credit) ? formatCurrency(l.credit) : '—'}
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
              <CTableFoot>
                <CTableRow className="fw-semibold">
                  <CTableDataCell colSpan={2} className="text-end">
                    Totals
                  </CTableDataCell>
                  <CTableDataCell className="text-end">{formatCurrency(totalDebit)}</CTableDataCell>
                  <CTableDataCell className="text-end">
                    {formatCurrency(totalCredit)}
                  </CTableDataCell>
                </CTableRow>
              </CTableFoot>
            </CTable>
          </>
        )}
      </CModalBody>
    </CModal>
  )
}

JournalEntryDetailModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  entry: PropTypes.object,
  onClose: PropTypes.func.isRequired,
}

JournalEntryDetailModal.defaultProps = {
  entry: null,
}

export default JournalEntryDetailModal
