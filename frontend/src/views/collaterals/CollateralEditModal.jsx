/**
 * CollateralEditModal
 *
 * Admin-only modal to correct collateral particulars after loan submission.
 * Editable fields: type, description, referenceNumber, registrationNumber,
 * estimatedValue, notes. Either referenceNumber or registrationNumber must
 * be provided.
 *
 * @module views/collaterals/CollateralEditModal
 */

import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CCol,
  CFormSelect,
  CSpinner,
} from '@coreui/react'
import { COLLATERAL_TYPE } from '../../constants/enums'

const CollateralEditModal = ({ visible, collateral, loading, error, onConfirm, onClose }) => {
  const [form, setForm] = useState({
    collateralType: '',
    description: '',
    referenceNumber: '',
    registrationNumber: '',
    estimatedValue: '',
    notes: '',
  })
  const [localError, setLocalError] = useState(null)

  useEffect(() => {
    if (visible && collateral) {
      setForm({
        collateralType: collateral.collateralType || '',
        description: collateral.description || '',
        referenceNumber: collateral.referenceNumber || '',
        registrationNumber: collateral.registrationNumber || '',
        estimatedValue: collateral.estimatedValue != null ? String(collateral.estimatedValue) : '',
        notes: collateral.notes || '',
      })
      setLocalError(null)
    }
  }, [visible, collateral])

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    setLocalError(null)
    if (!form.referenceNumber.trim() && !form.registrationNumber.trim()) {
      setLocalError('Either a reference number or registration number is required.')
      return
    }
    if (!form.estimatedValue) {
      setLocalError('Estimated value is required.')
      return
    }
    const data = {
      collateralType: form.collateralType || undefined,
      description: form.description.trim() || undefined,
      referenceNumber: form.referenceNumber.trim() || null,
      registrationNumber: form.registrationNumber.trim() || null,
      estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : null,
      notes: form.notes.trim() || null,
    }
    onConfirm(data)
  }

  const displayError = localError || (error ? (error.message || 'Failed to update collateral.') : null)

  return (
    <CModal visible={visible} onClose={onClose} alignment="center" size="lg">
      <CForm onSubmit={handleSubmit}>
        <CModalHeader>
          <CModalTitle>Edit Collateral</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {displayError && (
            <CAlert color="danger" dismissible onClose={() => setLocalError(null)}>
              {displayError}
            </CAlert>
          )}
          <CRow className="g-3">
            <CCol md={6}>
              <CFormLabel>Collateral type *</CFormLabel>
              <CFormSelect value={form.collateralType} onChange={setField('collateralType')} required>
                <option value="">—</option>
                {COLLATERAL_TYPE.values.map((v) => (
                  <option key={v} value={v}>
                    {COLLATERAL_TYPE.labels[v]}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Description *</CFormLabel>
              <CFormInput
                value={form.description}
                onChange={setField('description')}
                placeholder="e.g. Toyota Vitz 2018, KBZ 123A"
                required
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Reference number</CFormLabel>
              <CFormInput
                value={form.referenceNumber}
                onChange={setField('referenceNumber')}
                placeholder="Document / asset reference no."
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Registration number</CFormLabel>
              <CFormInput
                value={form.registrationNumber}
                onChange={setField('registrationNumber')}
                placeholder="Vehicle reg. / title reg. no."
              />
            </CCol>
            <CCol xs={12}>
              <div className="form-text text-warning-emphasis">
                At least one of reference number or registration number is required.
              </div>
            </CCol>
            <CCol md={4}>
              <CFormLabel>Estimated value *</CFormLabel>
              <CFormInput
                type="number"
                min="0"
                step="0.01"
                value={form.estimatedValue}
                onChange={setField('estimatedValue')}
                required
              />
            </CCol>
            <CCol md={8}>
              <CFormLabel>Notes</CFormLabel>
              <CFormTextarea
                rows={2}
                value={form.notes}
                onChange={setField('notes')}
              />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </CButton>
          <CButton type="submit" color="primary" disabled={loading}>
            {loading && <CSpinner size="sm" className="me-2" />}
            Save Changes
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

CollateralEditModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  collateral: PropTypes.object,
  loading: PropTypes.bool,
  error: PropTypes.object,
  onConfirm: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
}

CollateralEditModal.defaultProps = {
  collateral: null,
  loading: false,
  error: null,
}

export default CollateralEditModal
