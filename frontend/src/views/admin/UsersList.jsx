/**
 * UsersList
 *
 * Lists system users with search/role filters. Admin and manager roles can
 * create, edit, and delete users; admins (role 1) can also reset passwords.
 *
 * @module views/admin/UsersList
 */

import React, { useMemo, useState } from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormSelect,
  CRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilPencil, cilPlus, cilReload, cilTrash } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import ConfirmModal from '../../components/ConfirmModal'
import UserForm from './UserForm'
import ResetPasswordModal from './ResetPasswordModal'
import { useUsers, useDeleteUser } from '../../hooks/useUsers'
import { useRoles } from '../../hooks/useRoles'
import { useAuth } from '../../context/AuthContext'
import { ROLES, ROLE_GROUPS, ROLE_LABELS } from '../../constants/enums'
import { formatDate } from '../../utils/format'

const fullName = (u) =>
  [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(' ').trim() || '—'

const UsersList = () => {
  const { role: currentRole } = useAuth()
  const canManage = ROLE_GROUPS.STAFF.includes(currentRole)
  const isAdmin = currentRole === ROLES.ADMIN

  const { data: users = [], isLoading, error, refetch, isFetching } = useUsers()
  const { data: roles = [] } = useRoles()
  const deleteMutation = useDeleteUser()

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [toReset, setToReset] = useState(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const roleName = useMemo(() => {
    const map = {}
    roles.forEach((r) => {
      map[r.id] = r.name
    })
    return (id) => map[id] || ROLE_LABELS[id] || `Role ${id}`
  }, [roles])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter && String(u.role) !== String(roleFilter)) return false
      if (term) {
        const haystack = [fullName(u), u.email, u.phone, u.id_number]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [users, roleFilter, search])

  const openCreate = () => {
    setEditing(null)
    setShowForm(true)
  }

  const openEdit = (user) => {
    setEditing(user)
    setShowForm(true)
  }

  const columns = [
    { key: 'name', label: 'Name', render: (row) => <span className="fw-semibold">{fullName(row)}</span> },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone', render: (row) => row.phone || '—' },
    { key: 'role', label: 'Role', render: (row) => roleName(row.role) },
    { key: 'created_at', label: 'Created', render: (row) => formatDate(row.created_at) },
  ]

  if (canManage) {
    columns.push({
      key: 'actions',
      label: '',
      className: 'text-end',
      render: (row) => (
        <div className="d-flex gap-2 justify-content-end">
          {isAdmin && (
            <CButton
              color="light"
              size="sm"
              title="Reset password"
              onClick={(e) => {
                e.stopPropagation()
                setToReset(row)
              }}
            >
              <CIcon icon={cilLockLocked} />
            </CButton>
          )}
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
        <strong>Users</strong>
        <div className="d-flex gap-2">
          <CButton color="light" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <CIcon icon={cilReload} className="me-1" />
            Refresh
          </CButton>
          {canManage && (
            <CButton color="primary" size="sm" onClick={openCreate}>
              <CIcon icon={cilPlus} className="me-1" />
              New User
            </CButton>
          )}
        </div>
      </CCardHeader>
      <CCardBody>
        <CRow className="g-2 mb-3">
          <CCol md={6}>
            <CFormInput
              placeholder="Search name, email, phone, ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </CCol>
          <CCol md={4}>
            <CFormSelect value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </CFormSelect>
          </CCol>
        </CRow>

        <DataTable
          columns={columns}
          rows={filtered}
          loading={isLoading}
          error={error}
          emptyMessage="No users match your filters."
          onRowClick={canManage ? openEdit : undefined}
        />
      </CCardBody>

      <UserForm visible={showForm} user={editing} onClose={() => setShowForm(false)} />

      <ResetPasswordModal
        visible={Boolean(toReset)}
        user={toReset}
        onClose={() => setToReset(null)}
      />

      <ConfirmModal
        visible={Boolean(toDelete)}
        title="Delete User"
        body={toDelete ? `Delete user ${fullName(toDelete)} (${toDelete.email})?` : ''}
        confirmText="Delete"
        confirmColor="danger"
        loading={deleteMutation.isPending}
        onConfirm={runDelete}
        onClose={() => setToDelete(null)}
      />
    </CCard>
  )
}

export default UsersList
