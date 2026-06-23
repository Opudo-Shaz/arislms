/**
 * CollateralStatusModal
 *
 * Dialog for updating a collateral record's lifecycle status
 * (`PATCH /collaterals/:id/status`, admin only). Allows an optional note.
 *
 * @module views/collaterals/CollateralStatusModal
 */

import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CForm,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'

import StatusBadge from '../../components/StatusBadge'
import { COLLATERAL_STATUS } from '../../constants/enums'

const CollateralStatusModal = ({ visible, collateral, loading, error, onConfirm, onClose }) => {
  const [status, setStatus] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (visible && collateral) {
      setStatus(collateral.status || '')
      setNotes('')
    }
  }, [visible, collateral])

  if (!collateral) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!status) return
    onConfirm(status, notes.trim() || undefined)
  }

  return (
    <CModal visible={visible} onClose={onClose} alignment="center">
      <CForm onSubmit={handleSubmit}>
        <CModalHeader>
          <CModalTitle>Update Collateral Status</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && (
            <CAlert color="danger" dismissible>
              {error.message || 'Failed to update status.'}
            </CAlert>
          )}
          <div className="mb-3">
            <div className="text-body-secondary small">Collateral</div>
            <div>{collateral.description || collateral.collateralType || `#${collateral.id}`}</div>
            <div className="mt-1">
              Current: <StatusBadge enumDef={COLLATERAL_STATUS} value={collateral.status} />
            </div>
          </div>
          <CFormLabel>New status *</CFormLabel>
          <CFormSelect
            className="mb-3"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            required
          >
            {COLLATERAL_STATUS.values.map((v) => (
              <option key={v} value={v}>
                {COLLATERAL_STATUS.labels[v]}
              </option>
            ))}
          </CFormSelect>
          <CFormLabel>Notes</CFormLabel>
          <CFormTextarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </CButton>
          <CButton type="submit" color="primary" disabled={loading}>
            {loading && <CSpinner size="sm" className="me-2" />}
            Update
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

CollateralStatusModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  collateral: PropTypes.object,
  loading: PropTypes.bool,
  error: PropTypes.object,
  onConfirm: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
}

CollateralStatusModal.defaultProps = {
  collateral: null,
  loading: false,
  error: null,
}

export default CollateralStatusModal
