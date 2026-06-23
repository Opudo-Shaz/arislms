/**
 * ChartOfAccountsList
 *
 * Lists active chart-of-accounts entries with type/search filters. Admin and
 * manager roles can create, edit, and deactivate accounts via the modal form.
 *
 * @module views/accounting/ChartOfAccountsList
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
import { cilPencil, cilPlus, cilReload, cilTrash } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ConfirmModal from '../../components/ConfirmModal'
import ChartOfAccountForm from './ChartOfAccountForm'
import { useAccounts, useDeactivateAccount } from '../../hooks/useChartOfAccounts'
import { useAuth } from '../../context/AuthContext'
import { ACCOUNT_TYPE, NORMAL_BALANCE, ROLE_GROUPS } from '../../constants/enums'

const ChartOfAccountsList = () => {
  const { role } = useAuth()
  const canManage = ROLE_GROUPS.STAFF.includes(role)

  const { data: accounts = [], isLoading, error, refetch, isFetching } = useAccounts()
  const deactivateMutation = useDeactivateAccount()

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toDeactivate, setToDeactivate] = useState(null)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return accounts.filter((a) => {
      if (type && a.type !== type) return false
      if (term) {
        const haystack = [a.code, a.name, a.description].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [accounts, type, search])

  const openCreate = () => {
    setEditing(null)
    setShowForm(true)
  }

  const openEdit = (account) => {
    setEditing(account)
    setShowForm(true)
  }

  const columns = [
    { key: 'code', label: 'Code', render: (row) => <span className="fw-semibold">{row.code}</span> },
    { key: 'name', label: 'Name' },
    {
      key: 'type',
      label: 'Type',
      render: (row) => <StatusBadge enumDef={ACCOUNT_TYPE} value={row.type} />,
    },
    {
      key: 'normalBalance',
      label: 'Normal Balance',
      render: (row) => <StatusBadge enumDef={NORMAL_BALANCE} value={row.normalBalance} />,
    },
    {
      key: 'description',
      label: 'Description',
      render: (row) => row.description || '—',
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
            onClick={(e) => {
              e.stopPropagation()
              setToDeactivate(row)
            }}
          >
            <CIcon icon={cilTrash} />
          </CButton>
        </div>
      ),
    })
  }

  const runDeactivate = async () => {
    try {
      await deactivateMutation.mutateAsync(toDeactivate.id)
      setToDeactivate(null)
    } catch {
      // Error surfaced via mutation state; modal stays open.
    }
  }

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Chart of Accounts</strong>
        <div className="d-flex gap-2">
          <CButton color="light" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <CIcon icon={cilReload} className="me-1" />
            Refresh
          </CButton>
          {canManage && (
            <CButton color="primary" size="sm" onClick={openCreate}>
              <CIcon icon={cilPlus} className="me-1" />
              New Account
            </CButton>
          )}
        </div>
      </CCardHeader>
      <CCardBody>
        <CRow className="g-2 mb-3">
          <CCol md={6}>
            <CFormInput
              placeholder="Search code, name, description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </CCol>
          <CCol md={4}>
            <CFormSelect value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              {ACCOUNT_TYPE.values.map((v) => (
                <option key={v} value={v}>
                  {ACCOUNT_TYPE.labels[v]}
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
          emptyMessage="No accounts match your filters."
          onRowClick={canManage ? openEdit : undefined}
        />
      </CCardBody>

      <ChartOfAccountForm
        visible={showForm}
        account={editing}
        onClose={() => setShowForm(false)}
      />

      <ConfirmModal
        visible={Boolean(toDeactivate)}
        title="Deactivate Account"
        body={
          toDeactivate
            ? `Deactivate account ${toDeactivate.code} – ${toDeactivate.name}? It will be hidden from new entries.`
            : ''
        }
        confirmText="Deactivate"
        confirmColor="danger"
        loading={deactivateMutation.isPending}
        onConfirm={runDeactivate}
        onClose={() => setToDeactivate(null)}
      />
    </CCard>
  )
}

export default ChartOfAccountsList
