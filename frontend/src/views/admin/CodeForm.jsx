/**
 * CodeForm
 *
 * Modal create/edit form for a Code (key/name/description/isActive).
 * The `key` is immutable after creation (disabled when editing).
 *
 * @module views/admin/CodeForm
 */

import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CCol,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'

import { useCreateCode, useUpdateCode } from '../../hooks/useCodes'

const emptyForm = { key: '', name: '', description: '', isActive: true }

const toForm = (c) => ({
  key: c.key || '',
  name: c.name || '',
  description: c.description || '',
  isActive: c.isActive !== false,
})

const CodeForm = ({ visible, code, onClose }) => {
  const isEdit = Boolean(code)
  const createMutation = useCreateCode()
  const updateMutation = useUpdateCode()
  const saving = createMutation.isPending || updateMutation.isPending

  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (visible) {
      setForm(code ? toForm(code) : emptyForm)
      setError(null)
    }
  }, [visible, code])

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      if (isEdit) {
        const payload = {
          name: form.name.trim(),
          description: form.description.trim() || null,
          isActive: form.isActive,
        }
        await updateMutation.mutateAsync({ id: code.id, payload })
      } else {
        const payload = {
          key: form.key.trim().toUpperCase(),
          name: form.name.trim(),
          description: form.description.trim() || null,
          isActive: form.isActive,
        }
        await createMutation.mutateAsync(payload)
      }
      onClose()
    } catch (err) {
      setError(err)
    }
  }

  return (
    <CModal visible={visible} onClose={onClose} alignment="center">
      <CForm onSubmit={handleSubmit}>
        <CModalHeader>
          <CModalTitle>{isEdit ? 'Edit Code' : 'New Code'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError(null)}>
              <div>{error.message || 'Failed to save code.'}</div>
              {Array.isArray(error.data?.error) && (
                <ul className="mb-0 mt-2">
                  {error.data.error.map((m, i) => (
                    <li key={i}>{typeof m === 'string' ? m : m.message}</li>
                  ))}
                </ul>
              )}
            </CAlert>
          )}
          <CRow className="g-3">
            <CCol xs={12}>
              <CFormLabel>Key *</CFormLabel>
              <CFormInput
                value={form.key}
                onChange={setField('key')}
                placeholder="e.g. GENDER"
                maxLength={64}
                disabled={isEdit}
                required
              />
              <div className="form-text">Uppercase letters, numbers and underscores only. Cannot be changed later.</div>
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Name *</CFormLabel>
              <CFormInput value={form.name} onChange={setField('name')} maxLength={120} required />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Description</CFormLabel>
              <CFormTextarea
                rows={2}
                value={form.description}
                onChange={setField('description')}
                maxLength={500}
              />
            </CCol>
            <CCol xs={12}>
              <CFormCheck
                label="Active"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </CButton>
          <CButton color="primary" type="submit" disabled={saving}>
            {saving && <CSpinner size="sm" className="me-2" />}
            {isEdit ? 'Save Changes' : 'Create Code'}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

CodeForm.propTypes = {
  visible: PropTypes.bool.isRequired,
  code: PropTypes.object,
  onClose: PropTypes.func.isRequired,
}

export default CodeForm
