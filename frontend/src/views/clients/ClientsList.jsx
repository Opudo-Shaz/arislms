/**
 * ClientsList
 *
 * Filterable, server-side paginated table of clients. Filters (search, status,
 * KYC status, KYC queue) are sent as query params to the backend so results are
 * always accurate across pages. Rows link to the client detail page.
 *
 * @module views/clients/ClientsList
 */

import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAvatar,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormSelect,
  CPagination,
  CPaginationItem,
  CRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilReload } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import { useClients } from '../../hooks/useClients'
import { useAuth } from '../../context/AuthContext'
import { CLIENT_STATUS, KYC_STATUS, ROLE_GROUPS } from '../../constants/enums'

const PAGE_SIZE = 10

// Deterministic accent color per client so avatar initials aren't all the
// same color — cycles through the app's badge palette.
const AVATAR_COLORS = ['primary', 'info', 'success', 'warning', 'danger', 'secondary']
const avatarColorFor = (id) => AVATAR_COLORS[Number(id ?? 0) % AVATAR_COLORS.length]

const ClientsList = () => {
  const navigate = useNavigate()
  const { role } = useAuth()
  const canManage = ROLE_GROUPS.STAFF.includes(role)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [kycStatus, setKycStatus] = useState('')
  const [queueOnly, setQueueOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })

  const resetPageAnd = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  const handleSortChange = (key) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )
  }

  const params = {
    page,
    limit: PAGE_SIZE,
    search: search.trim() || undefined,
    status: queueOnly ? undefined : status || undefined,
    kycStatus: kycStatus || undefined,
    queueOnly: queueOnly ? 'true' : undefined,
  }

  const { data, isLoading, error, refetch, isFetching } = useClients(params)
  const total = data?.pagination?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Sorting is applied client-side to the current page only (the backend list
  // endpoint doesn't take a sort param); this still gives the header arrows a
  // real effect while keeping server-side pagination/filtering as-is.
  const SORT_ACCESSORS = {
    name: (r) => `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim().toLowerCase(),
    contact: (r) => (r.email ?? '').toLowerCase(),
    idNumber: (r) => (r.idDocumentNumber ?? '').toLowerCase(),
    address: (r) => [r.address?.city, r.address?.country].filter(Boolean).join(', ').toLowerCase(),
    status: (r) => r.status ?? '',
    kycStatus: (r) => r.kycStatus ?? '',
  }

  const clients = useMemo(() => {
    const rows = data?.clients ?? []
    if (!sortConfig.key) return rows
    const accessor = SORT_ACCESSORS[sortConfig.key]
    if (!accessor) return rows
    const sorted = [...rows].sort((a, b) => {
      const av = accessor(a)
      const bv = accessor(b)
      if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1
      if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
    return sorted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, sortConfig])

  const columns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      headerStyle: { width: '32%' },
      render: (row) => (
        <div className="d-flex align-items-center gap-2">
          <CAvatar color={avatarColorFor(row.id)} textColor="white" size="sm" className="flex-shrink-0">
            {`${row.firstName?.[0] || ''}${row.lastName?.[0] || ''}`.toUpperCase()}
          </CAvatar>
          <div>
            <div className="fw-semibold lh-sm">
              {row.firstName} {row.lastName}
            </div>
            {row.accountNumber && (
              <div className="small text-body-secondary font-monospace lh-sm">
                {row.accountNumber}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      label: 'Contact',
      sortable: true,
      render: (row) => (
        <div>
          <div className="lh-sm">{row.email}</div>
          <div className="small text-body-secondary lh-sm">{row.phone}</div>
        </div>
      ),
    },
    {
      key: 'idNumber',
      label: 'ID Number',
      sortable: true,
      className: 'text-nowrap',
      render: (row) => <div className="lh-sm font-monospace">{row.idDocumentNumber || '—'}</div>,
    },
    {
      key: 'address',
      label: 'Address',
      sortable: true,
      render: (row) => {
        const a = row.address
        if (!a || (!a.street && !a.city && !a.state && !a.country)) {
          return <span className="text-body-secondary">—</span>
        }
        const line2 = [a.city, a.state].filter(Boolean).join(', ')
        const line3 = [a.country, a.postalCode].filter(Boolean).join(' ')
        return (
          <div className="lh-sm">
            {a.street && <div>{a.street}</div>}
            {line2 && <div className="small text-body-secondary">{line2}</div>}
            {line3 && <div className="small text-body-secondary">{line3}</div>}
          </div>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      className: 'text-nowrap',
      headerClassName: 'text-nowrap',
      headerStyle: { width: '1%' },
      render: (row) => <StatusBadge enumDef={CLIENT_STATUS} value={row.status} />,
    },
    {
      key: 'kycStatus',
      label: 'KYC',
      sortable: true,
      className: 'text-nowrap',
      headerClassName: 'text-nowrap',
      headerStyle: { width: '1%' },
      render: (row) => <StatusBadge enumDef={KYC_STATUS} value={row.kycStatus} />,
    },
  ]

  return (
    <CCard className="mb-4 shadow-sm">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Clients</strong>
        <div className="d-flex gap-2">
          <CButton color="light" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <CIcon icon={cilReload} className="me-1" />
            Refresh
          </CButton>
          {canManage && (
            <CButton color="primary" size="sm" onClick={() => navigate('/clients/new')}>
              <CIcon icon={cilPlus} className="me-1" />
              New Client
            </CButton>
          )}
        </div>
      </CCardHeader>
      <CCardBody>
        <CRow className="g-2 mb-3">
          <CCol md={4}>
            <CFormInput
              placeholder="Search name, email, phone…"
              value={search}
              onChange={(e) => resetPageAnd(setSearch)(e.target.value)}
            />
          </CCol>
          <CCol md={3}>
            <CFormSelect
              value={status}
              onChange={(e) => resetPageAnd(setStatus)(e.target.value)}
              disabled={queueOnly}
            >
              <option value="">All statuses</option>
              {CLIENT_STATUS.values.map((v) => (
                <option key={v} value={v}>
                  {CLIENT_STATUS.labels[v]}
                </option>
              ))}
            </CFormSelect>
          </CCol>
          <CCol md={3}>
            <CFormSelect
              value={kycStatus}
              onChange={(e) => resetPageAnd(setKycStatus)(e.target.value)}
            >
              <option value="">All KYC</option>
              {KYC_STATUS.values.map((v) => (
                <option key={v} value={v}>
                  {KYC_STATUS.labels[v]}
                </option>
              ))}
            </CFormSelect>
          </CCol>
          <CCol md={2}>
            <CButton
              color={queueOnly ? 'warning' : 'light'}
              className="w-100"
              onClick={() => {
                setQueueOnly((v) => !v)
                setStatus('')
                setPage(1)
              }}
            >
              KYC Queue
            </CButton>
          </CCol>
        </CRow>

        <DataTable
          columns={columns}
          rows={clients}
          loading={isLoading}
          error={error}
          emptyMessage="No clients match your filters."
          onRowClick={(row) => navigate(`/clients/${row.id}`)}
          sortConfig={sortConfig}
          onSortChange={handleSortChange}
        />

        <div className="d-flex justify-content-between align-items-center mt-3">
          <span className="small text-body-secondary">
            Showing {clients.length} of {total} client{total === 1 ? '' : 's'}
            {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ''}
          </span>
          {totalPages > 1 && (
            <CPagination className="mb-0">
              <CPaginationItem disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </CPaginationItem>
              <CPaginationItem
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </CPaginationItem>
            </CPagination>
          )}
        </div>
      </CCardBody>
    </CCard>
  )
}

export default ClientsList
