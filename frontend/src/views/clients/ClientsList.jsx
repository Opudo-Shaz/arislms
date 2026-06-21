/**
 * ClientsList
 *
 * Filterable table of clients with quick filters (search, status, KYC status)
 * and a "KYC queue" toggle for clients awaiting verification. Rows link to the
 * client detail page.
 *
 * @module views/clients/ClientsList
 */

import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { cilPlus, cilReload } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import { useClients } from '../../hooks/useClients'
import { CLIENT_STATUS, KYC_STATUS } from '../../constants/enums'

/** Statuses that represent a pending KYC review. */
const KYC_QUEUE_STATUSES = ['pending', 'pending_kyc_reverification']

const ClientsList = () => {
  const navigate = useNavigate()
  const { data: clients = [], isLoading, error, refetch, isFetching } = useClients()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [kycStatus, setKycStatus] = useState('')
  const [queueOnly, setQueueOnly] = useState(false)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return clients.filter((c) => {
      if (status && c.status !== status) return false
      if (kycStatus && c.kycStatus !== kycStatus) return false
      if (queueOnly && !KYC_QUEUE_STATUSES.includes(c.status)) return false
      if (term) {
        const haystack = [c.firstName, c.lastName, c.email, c.phone, c.accountNumber]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [clients, search, status, kycStatus, queueOnly])

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
              onChange={(e) => setSearch(e.target.value)}
            />
          </CCol>
          <CCol md={3}>
            <CFormSelect value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {CLIENT_STATUS.values.map((v) => (
                <option key={v} value={v}>
                  {CLIENT_STATUS.labels[v]}
                </option>
              ))}
            </CFormSelect>
          </CCol>
          <CCol md={3}>
            <CFormSelect value={kycStatus} onChange={(e) => setKycStatus(e.target.value)}>
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
              onClick={() => setQueueOnly((v) => !v)}
            >
              KYC Queue
            </CButton>
          </CCol>
        </CRow>

        <DataTable
          columns={columns}
          rows={filtered}
          loading={isLoading}
          error={error}
          emptyMessage="No clients match your filters."
          onRowClick={(row) => navigate(`/clients/${row.id}`)}
        />
      </CCardBody>
    </CCard>
  )
}

export default ClientsList
