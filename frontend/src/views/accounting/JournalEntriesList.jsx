/**
 * JournalEntriesList
 *
 * Paginated, filterable list of ledger journal entries. Supports filtering by
 * source type and date range, posting a manual entry, viewing entry details,
 * and reversing posted entries (admin/manager).
 *
 * @module views/accounting/JournalEntriesList
 */

import React, { useState } from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormSelect,
  CFormInput,
  CRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilActionUndo, cilMagnifyingGlass, cilPlus, cilReload } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import CursorPager from '../../components/CursorPager'
import StatusBadge from '../../components/StatusBadge'
import ConfirmModal from '../../components/ConfirmModal'
import JournalEntryForm from './JournalEntryForm'
import JournalEntryDetailModal from './JournalEntryDetailModal'
import { useJournalEntries, useReverseJournalEntry } from '../../hooks/useLedger'
import { useCursorPagination } from '../../hooks/useCursorPagination'
import { useAuth } from '../../context/AuthContext'
import { JOURNAL_ENTRY_STATUS, LEDGER_SOURCE_TYPE } from '../../constants/enums'
import { formatCurrency, formatDateTime } from '../../utils/format'

const PAGE_SIZE = 10

const lineTotal = (entry) =>
  (entry.lines || []).reduce((s, l) => s + Number(l.debit || 0), 0)

const JournalEntriesList = () => {
  const { hasPermission } = useAuth()
  const canReverse = hasPermission('accounting:reverse_entry')
  const canPost = hasPermission('accounting:post_entry')

  const [sourceType, setSourceType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const filters = { sourceType, from, to }
  const { cursorParams, goTo } = useCursorPagination(filters)
  const params = { ...filters, ...cursorParams, limit: PAGE_SIZE }
  const { data, isLoading, error, refetch, isFetching } = useJournalEntries(params)
  const reverseMutation = useReverseJournalEntry()

  const entries = data?.entries ?? []

  const [showForm, setShowForm] = useState(false)
  const [viewEntry, setViewEntry] = useState(null)
  const [toReverse, setToReverse] = useState(null)

  const columns = [
    {
      key: 'reference',
      label: 'Reference',
      render: (row) => <span className="fw-semibold">{row.reference}</span>,
    },
    {
      key: 'entryDate',
      label: 'Date',
      render: (row) => formatDateTime(row.createdAt || row.entryDate),
    },
    {
      key: 'description',
      label: 'Description',
      render: (row) => row.description || '—',
    },
    {
      key: 'sourceType',
      label: 'Source',
      render: (row) => <StatusBadge enumDef={LEDGER_SOURCE_TYPE} value={row.sourceType} />,
    },
    {
      key: 'amount',
      label: 'Amount',
      className: 'text-end',
      render: (row) => formatCurrency(lineTotal(row)),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge enumDef={JOURNAL_ENTRY_STATUS} value={row.status} />,
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
              setViewEntry(row)
            }}
          >
            <CIcon icon={cilMagnifyingGlass} />
          </CButton>
          {canReverse && row.status === 'POSTED' && (
            <CButton
              color="warning"
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                setToReverse(row)
              }}
            >
              <CIcon icon={cilActionUndo} />
            </CButton>
          )}
        </div>
      ),
    },
  ]

  const runReverse = async (notes) => {
    try {
      await reverseMutation.mutateAsync({ id: toReverse.id, description: notes })
      setToReverse(null)
    } catch {
      // Error surfaced via mutation state; modal stays open.
    }
  }

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Journal Entries</strong>
        <div className="d-flex gap-2">
          <CButton color="light" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <CIcon icon={cilReload} className="me-1" />
            Refresh
          </CButton>
          {canPost && (
            <CButton color="primary" size="sm" onClick={() => setShowForm(true)}>
              <CIcon icon={cilPlus} className="me-1" />
              Post Entry
            </CButton>
          )}
        </div>
      </CCardHeader>
      <CCardBody>
        <CRow className="g-2 mb-3">
          <CCol md={4}>
            <CFormSelect
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
            >
              <option value="">All sources</option>
              {LEDGER_SOURCE_TYPE.values.map((v) => (
                <option key={v} value={v}>
                  {LEDGER_SOURCE_TYPE.labels[v]}
                </option>
              ))}
            </CFormSelect>
          </CCol>
          <CCol md={3}>
            <CFormInput
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </CCol>
          <CCol md={3}>
            <CFormInput
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </CCol>
        </CRow>

        <DataTable
          columns={columns}
          rows={entries}
          loading={isLoading}
          error={error}
          emptyMessage="No journal entries match your filters."
          onRowClick={(row) => setViewEntry(row)}
        />

        <CursorPager
          pagination={data?.pagination}
          onNavigate={goTo}
          disabled={isFetching}
          summary={`Showing ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`}
        />
      </CCardBody>

      <JournalEntryForm visible={showForm} onClose={() => setShowForm(false)} />

      <JournalEntryDetailModal
        visible={Boolean(viewEntry)}
        entry={viewEntry}
        onClose={() => setViewEntry(null)}
      />

      <ConfirmModal
        visible={Boolean(toReverse)}
        title="Reverse Journal Entry"
        body={
          toReverse
            ? `Posting a reversing entry for ${toReverse.reference}. This creates an offsetting entry and marks the original as reversed.`
            : ''
        }
        confirmText="Reverse"
        confirmColor="warning"
        withNotes
        notesLabel="Reason / description"
        loading={reverseMutation.isPending}
        onConfirm={runReverse}
        onClose={() => setToReverse(null)}
      />
    </CCard>
  )
}

export default JournalEntriesList
