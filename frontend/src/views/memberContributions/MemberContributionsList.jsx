/**
 * MemberContributionsList — server-side paginated contributions table.
 * @module views/memberContributions/MemberContributionsList
 */

import React, { useState } from 'react'
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
import { cilList, cilPlus, cilReload } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import CursorPager from '../../components/CursorPager'
import StatusBadge from '../../components/StatusBadge'
import MemberContributionForm from './MemberContributionForm'
import MemberStatementModal from './MemberStatementModal'
import { useContributions } from '../../hooks/useMemberContributions'
import { useCursorPagination } from '../../hooks/useCursorPagination'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useAuth } from '../../context/AuthContext'
import { CONTRIBUTION_TYPE } from '../../constants/enums'
import { formatCurrency, formatDate } from '../../utils/format'

const PAGE_SIZE = 20

const memberName = (row) =>
  row.client ? `${row.client.firstName} ${row.client.lastName}`.trim() : `Client #${row.clientId}`

const MemberContributionsList = () => {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('contributions:create')

  const [showForm, setShowForm] = useState(false)
  const [statementClient, setStatementClient] = useState(null)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim())

  const filters = { type: type || undefined, search: debouncedSearch || undefined }
  const { cursorParams, goTo } = useCursorPagination(filters)
  const params = { ...filters, ...cursorParams, limit: PAGE_SIZE }
  const { data, isLoading, error, refetch, isFetching } = useContributions(params)

  const records = data?.records ?? []

  const columns = [
    {
      key: 'member',
      label: 'Member',
      render: (row) => <span className="fw-semibold">{memberName(row)}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      render: (row) => <StatusBadge enumDef={CONTRIBUTION_TYPE} value={row.type} />,
    },
    {
      key: 'amount',
      label: 'Amount',
      className: 'text-end',
      render: (row) => formatCurrency(row.amount),
    },
    {
      key: 'contributionDate',
      label: 'Date',
      render: (row) => formatDate(row.contributionDate),
    },
    { key: 'notes', label: 'Notes', render: (row) => row.notes || '—' },
    {
      key: 'actions',
      label: '',
      className: 'text-end',
      render: (row) => (
        <CButton
          color="light"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            setStatementClient(row.clientId)
          }}
        >
          <CIcon icon={cilList} />
        </CButton>
      ),
    },
  ]

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Member Contributions</strong>
        <div className="d-flex gap-2">
          <CButton color="light" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <CIcon icon={cilReload} className="me-1" />
            Refresh
          </CButton>
          {canManage && (
            <CButton color="primary" size="sm" onClick={() => setShowForm(true)}>
              <CIcon icon={cilPlus} className="me-1" />
              Record Entry
            </CButton>
          )}
        </div>
      </CCardHeader>
      <CCardBody>
        <CRow className="g-2 mb-3">
          <CCol md={6}>
            <CFormInput
              placeholder="Search member name, notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </CCol>
          <CCol md={4}>
            <CFormSelect value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              {CONTRIBUTION_TYPE.values.map((v) => (
                <option key={v} value={v}>
                  {CONTRIBUTION_TYPE.labels[v]}
                </option>
              ))}
            </CFormSelect>
          </CCol>
        </CRow>

        <DataTable
          columns={columns}
          rows={records}
          loading={isLoading}
          error={error}
          emptyMessage="No contributions match your filters."
          onRowClick={(row) => setStatementClient(row.clientId)}
        />

        <CursorPager
          pagination={data?.pagination}
          onNavigate={goTo}
          disabled={isFetching}
          summary={`Showing ${records.length} record${records.length === 1 ? '' : 's'}`}
        />
      </CCardBody>

      <MemberContributionForm visible={showForm} onClose={() => setShowForm(false)} />

      <MemberStatementModal
        visible={statementClient != null}
        clientId={statementClient}
        onClose={() => setStatementClient(null)}
      />
    </CCard>
  )
}

export default MemberContributionsList


