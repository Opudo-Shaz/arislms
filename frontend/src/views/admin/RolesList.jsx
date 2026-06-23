/**
 * RolesList
 *
 * Lists roles with their permissions. Admin and manager roles can create, edit,
 * and delete roles via the modal form.
 *
 * @module views/admin/RolesList
 */

import React, { useMemo, useState } from 'react'
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CFormInput,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPencil, cilPlus, cilReload, cilTrash } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ConfirmModal from '../../components/ConfirmModal'
import RoleForm from './RoleForm'
import { useRoles, useDeleteRole } from '../../hooks/useRoles'
import { useAuth } from '../../context/AuthContext'
import { ROLE_GROUPS } from '../../constants/enums'

const ACTIVE_ENUM = { colors: { true: 'success', false: 'secondary' }, labels: { true: 'Active', false: 'Inactive' } }

const RolesList = () => {
  const { role: currentRole } = useAuth()
  const canManage = ROLE_GROUPS.STAFF.includes(currentRole)

  const { data: roles = [], isLoading, error, refetch, isFetching } = useRoles()
  const deleteMutation = useDeleteRole()

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return roles
    return roles.filter((r) =>
      [r.name, r.description].filter(Boolean).join(' ').toLowerCase().includes(term),
    )
  }, [roles, search])

  const openCreate = () => {
    setEditing(null)
    setShowForm(true)
  }

  const openEdit = (r) => {
    setEditing(r)
    setShowForm(true)
  }

  const columns = [
    { key: 'name', label: 'Name', render: (row) => <span className="fw-semibold">{row.name}</span> },
    { key: 'description', label: 'Description', render: (row) => row.description || '—' },
    {
      key: 'permissions',
      label: 'Permissions',
      render: (row) =>
        Array.isArray(row.permissions) && row.permissions.length ? (
          <div className="d-flex flex-wrap gap-1">
            {row.permissions.map((p) => (
              <CBadge key={p} color="primary" shape="rounded-pill">
                {p}
              </CBadge>
            ))}
          </div>
        ) : (
          <span className="text-body-secondary">None</span>
        ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => <StatusBadge enumDef={ACTIVE_ENUM} value={String(row.isActive !== false)} />,
    },
  ]

  if (canManage) {
    columns.push({
      key: 'actions',
      label: '',
      className: 'text-end',
      render: (row) => (
        <div className="d-flex gap-2 justify-content-end">
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
        </div>
      ),
    })
  }

  const runDelete = async () => {
    try {
      await deleteMutation.mutateAsync(toDelete.id)
      setToDelete(null)
    } catch {
      // Error surfaced via mutation state; modal stays open.
    }
  }

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Roles &amp; Permissions</strong>
        <div className="d-flex gap-2">
          <CButton color="light" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <CIcon icon={cilReload} className="me-1" />
            Refresh
          </CButton>
          {canManage && (
            <CButton color="primary" size="sm" onClick={openCreate}>
              <CIcon icon={cilPlus} className="me-1" />
              New Role
            </CButton>
          )}
        </div>
      </CCardHeader>
      <CCardBody>
        <div className="mb-3">
          <CFormInput
            placeholder="Search name or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <DataTable
          columns={columns}
          rows={filtered}
          loading={isLoading}
          error={error}
          emptyMessage="No roles match your search."
          onRowClick={canManage ? openEdit : undefined}
        />
      </CCardBody>

      <RoleForm visible={showForm} role={editing} onClose={() => setShowForm(false)} />

      <ConfirmModal
        visible={Boolean(toDelete)}
        title="Delete Role"
        body={toDelete ? `Delete role "${toDelete.name}"? This cannot be undone.` : ''}
        confirmText="Delete"
        confirmColor="danger"
        loading={deleteMutation.isPending}
        onConfirm={runDelete}
        onClose={() => setToDelete(null)}
      />
    </CCard>
  )
}

export default RolesList
