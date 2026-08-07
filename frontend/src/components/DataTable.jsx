/**
 * DataTable
 *
 * Lightweight, reusable table built on CoreUI `CTable` with built-in
 * loading, error, and empty states. Columns are declarative; an optional
 * `render` per column customizes cell output. Ships with a "modern" visual
 * treatment (row hover tint, subtle zebra striping, tighter row spacing)
 * plus opt-in column sorting indicators and a sticky header.
 *
 * @example
 * const columns = [
 *   { key: 'name', label: 'Name' },
 *   { key: 'status', label: 'Status', render: (row) => <StatusBadge .../> },
 * ]
 * <DataTable columns={columns} rows={clients} loading={isLoading}
 *   error={error} onRowClick={(row) => navigate(`/clients/${row.id}`)} />
 *
 * @module components/DataTable
 */

import React from 'react'
import PropTypes from 'prop-types'
import {
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSortAscending, cilSortDescending, cilSwapVertical } from '@coreui/icons'

const SortIndicator = ({ direction }) => (
  <CIcon
    icon={direction === 'asc' ? cilSortAscending : direction === 'desc' ? cilSortDescending : cilSwapVertical}
    size="sm"
    className={`ms-1 ${direction ? 'text-primary' : 'text-body-secondary opacity-50'}`}
  />
)

const DataTable = ({
  columns,
  rows,
  loading,
  error,
  emptyMessage,
  onRowClick,
  rowKey,
  sortConfig,
  onSortChange,
  stickyHeader,
  maxHeight,
}) => {
  const colSpan = columns.length

  const table = (
    <CTable hover responsive align="middle" className="mb-0 table-modern">
      <CTableHead className={`text-nowrap${stickyHeader ? ' sticky-top' : ''}`}>
        <CTableRow>
          {columns.map((col) => {
            const isSorted = sortConfig?.key === col.key
            return (
              <CTableHeaderCell
                key={col.key}
                className={`${col.headerClassName || ''}${col.sortable ? ' user-select-none' : ''}`}
                style={col.headerStyle}
                role={col.sortable ? 'button' : undefined}
                onClick={col.sortable && onSortChange ? () => onSortChange(col.key) : undefined}
              >
                {col.label}
                {col.sortable && <SortIndicator direction={isSorted ? sortConfig.direction : null} />}
              </CTableHeaderCell>
            )
          })}
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {loading && (
          <CTableRow>
            <CTableDataCell colSpan={colSpan} className="text-center py-5">
              <CSpinner color="primary" size="sm" /> <span className="ms-2">Loading…</span>
            </CTableDataCell>
          </CTableRow>
        )}

        {!loading && error && (
          <CTableRow>
            <CTableDataCell colSpan={colSpan} className="text-center text-danger py-5">
              {error.message || 'Failed to load data.'}
            </CTableDataCell>
          </CTableRow>
        )}

        {!loading && !error && rows.length === 0 && (
          <CTableRow>
            <CTableDataCell colSpan={colSpan} className="text-center text-body-secondary py-5">
              {emptyMessage}
            </CTableDataCell>
          </CTableRow>
        )}

        {!loading &&
          !error &&
          rows.map((row, idx) => (
            <CTableRow
              key={rowKey ? rowKey(row) : row.id ?? idx}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {columns.map((col) => (
                <CTableDataCell key={col.key} className={col.className} style={col.style}>
                  {col.render ? col.render(row) : row[col.key]}
                </CTableDataCell>
              ))}
            </CTableRow>
          ))}
      </CTableBody>
    </CTable>
  )

  if (!stickyHeader) return table

  return (
    <div className="border rounded overflow-auto" style={{ maxHeight }}>
      {table}
    </div>
  )
}

DataTable.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.node,
      render: PropTypes.func,
      className: PropTypes.string,
      headerClassName: PropTypes.string,
      style: PropTypes.object,
      headerStyle: PropTypes.object,
      sortable: PropTypes.bool,
    }),
  ).isRequired,
  rows: PropTypes.array,
  loading: PropTypes.bool,
  error: PropTypes.object,
  emptyMessage: PropTypes.string,
  onRowClick: PropTypes.func,
  rowKey: PropTypes.func,
  /** `{ key, direction: 'asc'|'desc' }` — pairs with a sortable column's `key`. */
  sortConfig: PropTypes.shape({
    key: PropTypes.string,
    direction: PropTypes.oneOf(['asc', 'desc']),
  }),
  /** Called with the clicked column's `key` when a sortable header is clicked. */
  onSortChange: PropTypes.func,
  /** Wraps the table in a scrollable container with a sticky header. */
  stickyHeader: PropTypes.bool,
  /** Max height of the scroll container when `stickyHeader` is set. */
  maxHeight: PropTypes.string,
}

DataTable.defaultProps = {
  rows: [],
  loading: false,
  error: null,
  emptyMessage: 'No records found.',
  stickyHeader: false,
  maxHeight: '65vh',
}

export default DataTable
