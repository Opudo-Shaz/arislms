/**
 * ConfirmModal
 *
 * Reusable confirmation dialog with an optional notes/reason textarea.
 * Used for destructive or state-changing actions (delete, KYC, status).
 *
 * @module components/ConfirmModal
 */

import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CButton,
  CForm,
  CFormLabel,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'

const ConfirmModal = ({
  visible,
  title,
  body,
  confirmText,
  confirmColor,
  loading,
  withNotes,
  notesLabel,
  notesRequired,
  onConfirm,
  onClose,
}) => {
  const [notes, setNotes] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (visible) {
      setNotes('')
      setTouched(false)
    }
  }, [visible])

  const notesInvalid = withNotes && notesRequired && !notes.trim()

  const handleConfirm = () => {
    setTouched(true)
    if (notesInvalid) return
    onConfirm(notes.trim())
  }

  return (
    <CModal visible={visible} onClose={onClose} alignment="center">
      <CModalHeader>
        <CModalTitle>{title}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {body}
        {withNotes && (
          <CForm className="mt-3">
            <CFormLabel>
              {notesLabel}
              {notesRequired ? ' *' : ' (optional)'}
            </CFormLabel>
            <CFormTextarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              invalid={touched && notesInvalid}
            />
            {touched && notesInvalid && (
              <div className="invalid-feedback d-block">This field is required.</div>
            )}
          </CForm>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </CButton>
        <CButton color={confirmColor} onClick={handleConfirm} disabled={loading}>
          {loading && <CSpinner size="sm" className="me-2" />}
          {confirmText}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

ConfirmModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  title: PropTypes.node.isRequired,
  body: PropTypes.node,
  confirmText: PropTypes.string,
  confirmColor: PropTypes.string,
  loading: PropTypes.bool,
  withNotes: PropTypes.bool,
  notesLabel: PropTypes.string,
  notesRequired: PropTypes.bool,
  onConfirm: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
}

ConfirmModal.defaultProps = {
  body: null,
  confirmText: 'Confirm',
  confirmColor: 'primary',
  loading: false,
  withNotes: false,
  notesLabel: 'Notes',
  notesRequired: false,
}

export default ConfirmModal
