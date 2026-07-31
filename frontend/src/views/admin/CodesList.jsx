/**
 * CodesList
 *
 * Admin-only view for managing config codes (used to populate dropdown fields
 * across the app) and their values. Only admins (role 1) can manage; the codes
 * themselves are consumed for read-only dropdowns by any authenticated user via
 * `CodeSelect`.
 *
 * @module views/admin/CodesList
 */

import React, { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CFormInput,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilList, cilPencil, cilPlus, cilReload, cilTrash } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ConfirmModal from '../../components/ConfirmModal'
import CodeForm from './CodeForm'
import CodeValuesManager from './CodeValuesManager'
import { useCodes, useDeleteCode } from '../../hooks/useCodes'
import { useAuth } from '../../context/AuthContext'

const ACTIVE_ENUM = { colors: { true: 'success', false: 'secondary' }, labels: { true: 'Active', false: 'Inactive' } }

const CodesList = () => {
  const { role: currentRole } = useAuth()
  const isAdmin = currentRole === 1

  const { data: codes = [], isLoading, error, refetch, isFetching } = useCodes()
  const deleteMutation = useDeleteCode()

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [managingValuesFor, setManagingValuesFor] = useState(null)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return codes
    return codes.filter((c) =>
      [c.key, c.name, c.description].filter(Boolean).join(' ').toLowerCase().includes(term),
    )
  }, [codes, search])

  const openCreate = () => {
    setEditing(null)
    setShowForm(true)
  }

  const openEdit = (c) => {
    setEditing(c)
    setShowForm(true)
  }

  const columns = [
    { key: 'key', label: 'Key', render: (row) => <span className="fw-semibold">{row.key}</span> },
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description', render: (row) => row.description || '—' },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => <StatusBadge enumDef={ACTIVE_ENUM} value={String(row.isActive !== false)} />,
    },
  ]

  columns.push({
    key: 'actions',
    label: '',
    className: 'text-end',
    render: (row) => (
      <div className="d-flex gap-2 justify-content-end">
        <CButton
          color="light"
          size="sm"
          className="d-inline-flex align-items-center text-nowrap"
          title="Manage Values"
          onClick={(e) => {
            e.stopPropagation()
            setManagingValuesFor(row)
          }}
        >
          <CIcon icon={cilList} className="me-1" />
          Values
        </CButton>
        {isAdmin && (
          <>
            <CButton
              color="light"
              size="sm"
              title="Edit"
              onClick={(e) => {
                e.stopPropagation()
                openEdit(row)
              }}
            >
              <CIcon icon={cilPencil} />
            </CButton>
            <CButton
              color="danger"
              size="sm"
              variant="outline"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation()
                setToDelete(row)
              }}
            >
              <CIcon icon={cilTrash} />
            </CButton>
          </>
        )}
      </div>
    ),
  })

  const runDelete = async () => {
    try {
      await deleteMutation.mutateAsync(toDelete.id)
      setToDelete(null)
    } catch {
      // Error surfaced via mutation state; modal stays open.
    }
  }

  if (!isAdmin) return <Navigate to="/unauthorized" replace />

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Codes</strong>
        <div className="d-flex gap-2">
          <CButton color="light" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <CIcon icon={cilReload} className="me-1" />
            Refresh
          </CButton>
          <CButton color="primary" size="sm" onClick={openCreate}>
            <CIcon icon={cilPlus} className="me-1" />
            New Code
          </CButton>
        </div>
      </CCardHeader>
      <CCardBody>
        <div className="mb-3">
          <CFormInput
            placeholder="Search key, name or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <DataTable
          columns={columns}
          rows={filtered}
          loading={isLoading}
          error={error}
          emptyMessage="No codes match your search."
        />
      </CCardBody>

      <CodeForm visible={showForm} code={editing} onClose={() => setShowForm(false)} />

      <CodeValuesManager
        visible={Boolean(managingValuesFor)}
        code={managingValuesFor}
        onClose={() => setManagingValuesFor(null)}
      />

      <ConfirmModal
        visible={Boolean(toDelete)}
        title="Delete Code"
        body={
          toDelete
            ? `Delete code "${toDelete.key}"? Its values will also be deleted. This cannot be undone.`
            : ''
        }
        confirmText="Delete"
        confirmColor="danger"
        loading={deleteMutation.isPending}
        onConfirm={runDelete}
        onClose={() => setToDelete(null)}
      />
    </CCard>
  )
}

export default CodesList
