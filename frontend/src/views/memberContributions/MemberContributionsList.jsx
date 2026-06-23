/**
 * MemberContributionsList
 *
 * Lists all member contributions and withdrawals with type/search filters.
 * Each record carries an embedded `client`. Staff can record new entries and
 * open a member's full statement.
 *
 * @module views/memberContributions/MemberContributionsList
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
import { cilList, cilPlus, cilReload } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import MemberContributionForm from './MemberContributionForm'
import MemberStatementModal from './MemberStatementModal'
import { useContributions } from '../../hooks/useMemberContributions'
import { useAuth } from '../../context/AuthContext'
import { CONTRIBUTION_TYPE, ROLE_GROUPS } from '../../constants/enums'
import { formatCurrency, formatDate } from '../../utils/format'

const memberName = (row) =>
  row.client ? `${row.client.firstName} ${row.client.lastName}`.trim() : `Client #${row.clientId}`

const MemberContributionsList = () => {
  const { role } = useAuth()
  const canManage = ROLE_GROUPS.STAFF.includes(role)

  const { data: records = [], isLoading, error, refetch, isFetching } = useContributions()

  const [showForm, setShowForm] = useState(false)
  const [statementClient, setStatementClient] = useState(null)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return records.filter((r) => {
      if (type && r.type !== type) return false
      if (term) {
        const haystack = [memberName(r), r.amount, r.notes].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [records, type, search])

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
              placeholder="Search member, notes…"
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
          rows={filtered}
          loading={isLoading}
          error={error}
          emptyMessage="No contributions match your filters."
          onRowClick={(row) => setStatementClient(row.clientId)}
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
