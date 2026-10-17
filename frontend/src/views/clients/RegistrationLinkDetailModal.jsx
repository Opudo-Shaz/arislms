/**
 * RegistrationLinkDetailModal
 *
 * Usage of one registration link: how many clients registered through it
 * and who they are, each linking to the client record for KYC review.
 *
 * @module views/clients/RegistrationLinkDetailModal
 */

import React from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'

import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import { useRegistrationLink } from '../../hooks/useClientRegistrationLinks'
import { CLIENT_REGISTRATION_LINK_STATUS, CLIENT_STATUS, KYC_STATUS } from '../../constants/enums'
import { formatDate, formatDateTime } from '../../utils/format'

const RegistrationLinkDetailModal = ({ linkId, onClose }) => {
  const navigate = useNavigate()
  const { data: link, isLoading, error } = useRegistrationLink(linkId)

  const columns = [
    {
      key: 'name',
      label: 'Client',
      render: (c) => (
        <div>
          <div className="fw-semibold">
            {c.firstName} {c.lastName}
          </div>
          <div className="small text-body-secondary font-monospace">{c.accountNumber}</div>
        </div>
      ),
    },
    {
      key: 'contact',
      label: 'Contact',
      render: (c) => (
        <div className="small">
          <div>{c.email}</div>
          <div className="text-body-secondary">{c.phone}</div>
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (c) => <StatusBadge enumDef={CLIENT_STATUS} value={c.status} /> },
    { key: 'kycStatus', label: 'KYC', render: (c) => <StatusBadge enumDef={KYC_STATUS} value={c.kycStatus} /> },
    { key: 'registeredAt', label: 'Registered', render: (c) => formatDateTime(c.registeredAt) },
  ]

  return (
    <CModal visible={Boolean(linkId)} onClose={onClose} alignment="center" size="xl" scrollable>
      <CModalHeader>
        <CModalTitle>{link?.label || 'Registration link'}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {isLoading && (
          <div className="text-center py-4">
            <CSpinner color="primary" />
          </div>
        )}
        {error && <CAlert color="danger">{error.message || 'Failed to load the link.'}</CAlert>}
        {link && (
          <>
            <div className="d-flex flex-wrap gap-4 mb-3">
              <div>
                <div className="text-body-secondary small">Status</div>
                <StatusBadge enumDef={CLIENT_REGISTRATION_LINK_STATUS} value={link.status} />
              </div>
              <div>
                <div className="text-body-secondary small">Expires</div>
                {formatDate(link.expiresAt)}
              </div>
              <div>
                <div className="text-body-secondary small">Clients registered</div>
                <strong>{link.usedCount}</strong>
              </div>
              <div>
                <div className="text-body-secondary small">Created</div>
                {formatDate(link.createdAt)}
                {link.createdByName ? ` by ${link.createdByName}` : ''}
              </div>
            </div>
            <DataTable
              columns={columns}
              rows={link.clients}
              rowKey={(c) => c.id}
              emptyMessage="No one has registered through this link yet."
              onRowClick={(c) => navigate(`/clients/${c.id}`)}
            />
          </>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" onClick={onClose}>
          Close
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

RegistrationLinkDetailModal.propTypes = {
  linkId: PropTypes.number,
  onClose: PropTypes.func.isRequired,
}

export default RegistrationLinkDetailModal
