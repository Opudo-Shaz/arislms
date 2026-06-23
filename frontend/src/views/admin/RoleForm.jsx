/**
 * RoleForm
 *
 * Modal create/edit form for a role, including a simple permissions editor
 * (string tags stored as a JSONB array on the backend). When `role` is provided
 * the form is in edit mode.
 *
 * @module views/admin/RoleForm
 */

import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CBadge,
  CButton,
  CCol,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CInputGroup,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilX } from '@coreui/icons'

import { useCreateRole, useUpdateRole } from '../../hooks/useRoles'

const emptyForm = { name: '', description: '', isActive: true, permissions: [] }

const toForm = (r) => ({
  name: r.name || '',
  description: r.description || '',
  isActive: r.isActive !== false,
  permissions: Array.isArray(r.permissions) ? [...r.permissions] : [],
})

const RoleForm = ({ visible, role, onClose }) => {
  const isEdit = Boolean(role)
  const createMutation = useCreateRole()
  const updateMutation = useUpdateRole()
  const saving = createMutation.isPending || updateMutation.isPending

  const [form, setForm] = useState(emptyForm)
  const [permInput, setPermInput] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (visible) {
      setForm(role ? toForm(role) : emptyForm)
      setPermInput('')
      setError(null)
    }
  }, [visible, role])

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const addPermission = () => {
    const value = permInput.trim()
    if (!value) return
    setForm((f) =>
      f.permissions.includes(value) ? f : { ...f, permissions: [...f.permissions, value] },
    )
    setPermInput('')
  }

  const removePermission = (value) =>
    setForm((f) => ({ ...f, permissions: f.permissions.filter((p) => p !== value) }))

  const handlePermKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addPermission()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      permissions: form.permissions,
      isActive: form.isActive,
    }
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: role.id, payload })
      } else {
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
          <CModalTitle>{isEdit ? 'Edit Role' : 'New Role'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError(null)}>
              <div>{error.message || 'Failed to save role.'}</div>
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
              <CFormLabel>Name *</CFormLabel>
              <CFormInput value={form.name} onChange={setField('name')} maxLength={100} required />
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
              <CFormLabel>Permissions</CFormLabel>
              <CInputGroup>
                <CFormInput
                  value={permInput}
                  onChange={(e) => setPermInput(e.target.value)}
                  onKeyDown={handlePermKeyDown}
                  placeholder="e.g. clients:read"
                />
                <CButton type="button" color="secondary" variant="outline" onClick={addPermission}>
                  <CIcon icon={cilPlus} />
                </CButton>
              </CInputGroup>
              <div className="d-flex flex-wrap gap-2 mt-2">
                {form.permissions.length === 0 && (
                  <span className="text-body-secondary">No permissions assigned.</span>
                )}
                {form.permissions.map((p) => (
                  <CBadge
                    key={p}
                    color="primary"
                    shape="rounded-pill"
                    className="d-inline-flex align-items-center"
                  >
                    {p}
                    <CIcon
                      icon={cilX}
                      size="sm"
                      className="ms-1"
                      style={{ cursor: 'pointer' }}
                      onClick={() => removePermission(p)}
                    />
                  </CBadge>
                ))}
              </div>
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
            {isEdit ? 'Save Changes' : 'Create Role'}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

RoleForm.propTypes = {
  visible: PropTypes.bool.isRequired,
  role: PropTypes.object,
  onClose: PropTypes.func.isRequired,
}

RoleForm.defaultProps = {
  role: null,
}

export default RoleForm
