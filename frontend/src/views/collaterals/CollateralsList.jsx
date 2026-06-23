/**
 * CollateralsList
 *
 * Collaterals are exposed per loan by the backend, so this page provides a loan
 * selector and then lists that loan's collateral records. Admins can update a
 * record's lifecycle status.
 *
 * @module views/collaterals/CollateralsList
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormSelect,
  CRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPencil } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import CollateralStatusModal from './CollateralStatusModal'
import { useLoanCollaterals, useUpdateCollateralStatus } from '../../hooks/useCollaterals'
import { useLoans } from '../../hooks/useLoans'
import { useAuth } from '../../context/AuthContext'
import { COLLATERAL_STATUS, COLLATERAL_TYPE, ROLES } from '../../constants/enums'
import { formatCurrency } from '../../utils/format'

const CollateralsList = () => {
  const navigate = useNavigate()
  const { role } = useAuth()
  const isAdmin = role === ROLES.ADMIN

  const { data: loansResult } = useLoans({ limit: 500 })
  const loans = loansResult?.loans ?? []

  const [loanId, setLoanId] = useState('')
  const [editTarget, setEditTarget] = useState(null)

  const { data: collaterals = [], isLoading, error } = useLoanCollaterals(loanId)
  const updateMutation = useUpdateCollateralStatus()

  const loanLabel = (l) =>
    (l.referenceCode || `Loan #${l.id}`) +
    (l.client ? ` — ${l.client.firstName} ${l.client.lastName}`.trim() : ` — Client #${l.clientId}`)

  const runUpdate = async (status, notes) => {
    try {
      await updateMutation.mutateAsync({ id: editTarget.id, status, notes, loanId })
      setEditTarget(null)
    } catch {
      // Error surfaced via mutation state; modal stays open.
    }
  }

  const columns = [
    {
      key: 'type',
      label: 'Type',
      render: (r) => <StatusBadge enumDef={COLLATERAL_TYPE} value={r.collateralType} />,
    },
    { key: 'description', label: 'Description', render: (r) => r.description || '—' },
    {
      key: 'reference',
      label: 'Reference',
      render: (r) => r.registrationNumber || r.referenceNumber || '—',
    },
    {
      key: 'estimatedValue',
      label: 'Est. Value',
      render: (r) => formatCurrency(r.estimatedValue),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge enumDef={COLLATERAL_STATUS} value={r.status} />,
    },
    ...(isAdmin
      ? [
          {
            key: 'actions',
            label: '',
            className: 'text-end',
            render: (r) => (
              <CButton color="warning" size="sm" variant="outline" onClick={() => setEditTarget(r)}>
                <CIcon icon={cilPencil} className="me-1" />
                Status
              </CButton>
            ),
          },
        ]
      : []),
  ]

  return (
    <CCard className="mb-4">
      <CCardHeader>
        <strong>Collaterals</strong>
      </CCardHeader>
      <CCardBody>
        <CRow className="g-2 mb-3">
          <CCol md={6}>
            <CFormSelect value={loanId} onChange={(e) => setLoanId(e.target.value)}>
              <option value="">Select a loan…</option>
              {loans.map((l) => (
                <option key={l.id} value={l.id}>
                  {loanLabel(l)}
                </option>
              ))}
            </CFormSelect>
          </CCol>
          {loanId && (
            <CCol md="auto">
              <CButton color="light" size="sm" onClick={() => navigate(`/loans/${loanId}`)}>
                View loan
              </CButton>
            </CCol>
          )}
        </CRow>

        {loanId ? (
          <DataTable
            columns={columns}
            rows={collaterals}
            loading={isLoading}
            error={error}
            emptyMessage="No collateral recorded for this loan."
          />
        ) : (
          <div className="text-body-secondary py-3">
            Select a loan to view its collateral records.
          </div>
        )}
      </CCardBody>

      <CollateralStatusModal
        visible={Boolean(editTarget)}
        collateral={editTarget}
        loading={updateMutation.isPending}
        error={updateMutation.error}
        onConfirm={runUpdate}
        onClose={() => setEditTarget(null)}
      />
    </CCard>
  )
}

export default CollateralsList
