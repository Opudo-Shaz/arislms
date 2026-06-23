/**
 * ClientsList
 *
 * Filterable, server-side paginated table of clients. Filters (search, status,
 * KYC status, KYC queue) are sent as query params to the backend so results are
 * always accurate across pages. Rows link to the client detail page.
 *
 * @module views/clients/ClientsList
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
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
import { CLIENT_STATUS, KYC_STATUS } from '../../constants/enums'

const PAGE_SIZE = 20

const ClientsList = () => {
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [kycStatus, setKycStatus] = useState('')
  const [queueOnly, setQueueOnly] = useState(false)
  const [page, setPage] = useState(1)

  const resetPageAnd = (setter) => (value) => {
    setter(value)
    setPage(1)
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
  const clients = data?.clients ?? []
  const total = data?.pagination?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <div>
          <div className="fw-semibold">
            {row.firstName} {row.lastName}
          </div>
          {row.accountNumber && (
            <div className="small text-body-secondary">{row.accountNumber}</div>
          )}
        </div>
      ),
    },
    {
      key: 'contact',
      label: 'Contact',
      render: (row) => (
        <div>
          <div>{row.email}</div>
          <div className="small text-body-secondary">{row.phone}</div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge enumDef={CLIENT_STATUS} value={row.status} />,
    },
    {
      key: 'kycStatus',
      label: 'KYC',
      render: (row) => <StatusBadge enumDef={KYC_STATUS} value={row.kycStatus} />,
    },
  ]

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Clients</strong>
        <div className="d-flex gap-2">
          <CButton color="light" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <CIcon icon={cilReload} className="me-1" />
            Refresh
          </CButton>
          <CButton color="primary" size="sm" onClick={() => navigate('/clients/new')}>
            <CIcon icon={cilPlus} className="me-1" />
            New Client
          </CButton>
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
        />

        {totalPages > 1 && (
          <div className="d-flex justify-content-between align-items-center mt-3">
            <span className="small text-body-secondary">
              {total} clients · page {page} of {totalPages}
            </span>
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
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}

export default ClientsList
