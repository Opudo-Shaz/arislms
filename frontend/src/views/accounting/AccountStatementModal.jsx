/**
 * AccountStatementModal
 *
 * Displays a ledger statement for a single chart-of-accounts entry over a
 * user-selected date range. Preset period buttons (This Month / Last Month /
 * This Quarter / This Year / Custom) feed a DateRangePicker (react-day-picker)
 * panel. The statement rows show date, reference, description, debit, credit
 * and running balance.
 *
 * @module views/accounting/AccountStatementModal
 */

import React, { useState, useCallback } from 'react'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CButtonGroup,
  CAlert,
  CSpinner,
  CTable,
  CTableHead,
  CTableBody,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
  CBadge,
} from '@coreui/react'
import DateRangePicker from '../../components/DateRangePicker'

import { useAccountStatement } from '../../hooks/useChartOfAccounts'
import { formatCurrency, formatDate } from '../../utils/format'

// ─── preset helpers ────────────────────────────────────────────────────────────

// Local-calendar formatting: toISOString() is UTC and shifts local midnight to the
// previous day in UTC+ timezones.
const pad = (n) => String(n).padStart(2, '0')
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const today = () => new Date()

const presets = [
  {
    label: 'This Month',
    get() {
      const d = today()
      return [new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 0)]
    },
  },
  {
    label: 'Last Month',
    get() {
      const d = today()
      return [new Date(d.getFullYear(), d.getMonth() - 1, 1), new Date(d.getFullYear(), d.getMonth(), 0)]
    },
  },
  {
    label: 'This Quarter',
    get() {
      const d = today()
      const q = Math.floor(d.getMonth() / 3)
      return [new Date(d.getFullYear(), q * 3, 1), new Date(d.getFullYear(), q * 3 + 3, 0)]
    },
  },
  {
    label: 'This Year',
    get() {
      const d = today()
      return [new Date(d.getFullYear(), 0, 1), new Date(d.getFullYear(), 11, 31)]
    },
  },
  { label: 'Custom', get: null },
]

// ─── component ─────────────────────────────────────────────────────────────────

const AccountStatementModal = ({ visible, account, onClose }) => {
  const defaultPreset = presets[0]

  // queryDates only updates when a full [start, end] range is confirmed.
  const [pickerOpen, setPickerOpen] = useState(false)
  const [queryDates, setQueryDates] = useState(defaultPreset.get())
  const [activePreset, setActivePreset] = useState(defaultPreset.label)

  // Reset to default preset whenever the account changes so previous account's
  // date state doesn't linger when the modal is reused for a new account.
  const prevCodeRef = React.useRef(account?.code)
  React.useEffect(() => {
    if (account?.code && account.code !== prevCodeRef.current) {
      prevCodeRef.current = account.code
      const range = defaultPreset.get()
      setQueryDates(range)
      setActivePreset(defaultPreset.label)
      setPickerOpen(false)
    }
  }, [account?.code]) // eslint-disable-line react-hooks/exhaustive-deps

  const [from, to] = queryDates.map((d) => (d ? fmt(d) : null))

  const {
    data,
    isLoading,
    isFetching,
    error,
  } = useAccountStatement(account?.code, from, to)

  const rows = data?.rows ?? []
  const acc = data?.account ?? account

  const selectPreset = useCallback((preset) => {
    setActivePreset(preset.label)
    if (preset.get) {
      setQueryDates(preset.get()) // presets always produce a complete range
      setPickerOpen(false)
    } else {
      setPickerOpen((o) => !o)
    }
  }, [])

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0)
  const closingBalance = rows.length ? rows[rows.length - 1].balance : 0

  return (
    <CModal visible={visible} onClose={onClose} size="xl" scrollable>
      <CModalHeader>
        <CModalTitle>
          Account Statement&nbsp;
          {acc && (
            <span className="text-muted fw-normal fs-6">
              {acc.code} – {acc.name}
            </span>
          )}
        </CModalTitle>
      </CModalHeader>

      <CModalBody>
        {/* ── period picker ── */}
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <CButtonGroup size="sm">
            {presets.map((p) => (
              <CButton
                key={p.label}
                color={activePreset === p.label ? 'primary' : 'light'}
                onClick={() => selectPreset(p)}
              >
                {p.label}
              </CButton>
            ))}
          </CButtonGroup>

          {from && to && (
            <small className="text-muted">
              {formatDate(from)} → {formatDate(to)}
            </small>
          )}

          {isFetching && !isLoading && <CSpinner size="sm" />}
        </div>

        {pickerOpen && (
          <DateRangePicker
            from={queryDates[0]}
            to={queryDates[1]}
            maxDate={today()}
            onCancel={() => setPickerOpen(false)}
            onApply={(start, end) => {
              setQueryDates([start, end])
              setPickerOpen(false)
            }}
          />
        )}

        {/* ── error ── */}
        {error && (
          <CAlert color="danger" className="py-2">
            {error?.data?.message ?? error?.message ?? 'Failed to load statement.'}
          </CAlert>
        )}

        {/* ── loading ── */}
        {isLoading && (
          <div className="text-center py-4">
            <CSpinner />
          </div>
        )}

        {/* ── statement table ── */}
        {!isLoading && !error && (
          <>
            {rows.length === 0 ? (
              <p className="text-muted text-center py-4">No transactions in this period.</p>
            ) : (
              <CTable striped hover responsive small bordered>
                <CTableHead color="dark">
                  <CTableRow>
                    <CTableHeaderCell>Date</CTableHeaderCell>
                    <CTableHeaderCell>Reference</CTableHeaderCell>
                    <CTableHeaderCell>Description</CTableHeaderCell>
                    <CTableHeaderCell className="text-end">Debit</CTableHeaderCell>
                    <CTableHeaderCell className="text-end">Credit</CTableHeaderCell>
                    <CTableHeaderCell className="text-end">Balance</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {rows.map((r, i) => (
                    <CTableRow key={i}>
                      <CTableDataCell className="text-nowrap">{formatDate(r.date)}</CTableDataCell>
                      <CTableDataCell>
                        <CBadge color="secondary" className="font-monospace">
                          {r.reference}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell>{r.description || '—'}</CTableDataCell>
                      <CTableDataCell className="text-end font-monospace">
                        {r.debit > 0 ? formatCurrency(r.debit) : '—'}
                      </CTableDataCell>
                      <CTableDataCell className="text-end font-monospace">
                        {r.credit > 0 ? formatCurrency(r.credit) : '—'}
                      </CTableDataCell>
                      <CTableDataCell
                        className={`text-end font-monospace fw-semibold ${r.balance < 0 ? 'text-danger' : ''}`}
                      >
                        {formatCurrency(Math.abs(r.balance))}
                        {r.balance < 0 && <span className="ms-1 text-danger small">CR</span>}
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
                <CTableBody>
                  <CTableRow color="light" className="fw-semibold">
                    <CTableDataCell colSpan={3} className="text-end">
                      Totals
                    </CTableDataCell>
                    <CTableDataCell className="text-end font-monospace">
                      {formatCurrency(totalDebit)}
                    </CTableDataCell>
                    <CTableDataCell className="text-end font-monospace">
                      {formatCurrency(totalCredit)}
                    </CTableDataCell>
                    <CTableDataCell
                      className={`text-end font-monospace ${closingBalance < 0 ? 'text-danger' : 'text-success'}`}
                    >
                      {formatCurrency(Math.abs(closingBalance))}
                      {closingBalance < 0 && <span className="ms-1 small">CR</span>}
                    </CTableDataCell>
                  </CTableRow>
                </CTableBody>
              </CTable>
            )}
          </>
        )}
      </CModalBody>

      <CModalFooter>
        <CButton color="secondary" onClick={onClose}>
          Close
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

export default AccountStatementModal
