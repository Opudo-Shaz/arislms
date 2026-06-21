/**
 * DataTable
 *
 * Lightweight, reusable table built on CoreUI `CTable` with built-in
 * loading, error, and empty states. Columns are declarative; an optional
 * `render` per column customizes cell output.
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

const DataTable = ({ columns, rows, loading, error, emptyMessage, onRowClick, rowKey }) => {
  const colSpan = columns.length

  return (
    <CTable hover responsive align="middle" className="mb-0 border">
      <CTableHead className="text-nowrap">
        <CTableRow>
          {columns.map((col) => (
            <CTableHeaderCell key={col.key} className={col.headerClassName}>
              {col.label}
            </CTableHeaderCell>
          ))}
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
                <CTableDataCell key={col.key} className={col.className}>
                  {col.render ? col.render(row) : row[col.key]}
                </CTableDataCell>
              ))}
            </CTableRow>
          ))}
      </CTableBody>
    </CTable>
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
    }),
  ).isRequired,
  rows: PropTypes.array,
  loading: PropTypes.bool,
  error: PropTypes.object,
  emptyMessage: PropTypes.string,
  onRowClick: PropTypes.func,
  rowKey: PropTypes.func,
}

DataTable.defaultProps = {
  rows: [],
  loading: false,
  error: null,
  emptyMessage: 'No records found.',
}

export default DataTable
