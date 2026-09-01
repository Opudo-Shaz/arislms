/**
 * RoleForm
 *
 * Modal create/edit form for a role. Permissions are chosen from a grouped
 * checkbox picker built from the shared PERMISSION_GROUPS list — arbitrary
 * strings can no longer be entered, so the picker is the sole guard against
 * invalid permission values. When `role` is provided the form is in edit mode.
 *
 * @module views/admin/RoleForm
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

import { PERMISSION_GROUPS } from '../../constants/enums'
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
  const [error, setError] = useState(null)

  useEffect(() => {
    if (visible) {
      setForm(role ? toForm(role) : emptyForm)
      setError(null)
    }
  }, [visible, role])

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const togglePermission = (value) =>
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(value)
        ? f.permissions.filter((p) => p !== value)
        : [...f.permissions, value],
    }))

  const toggleGroup = (group, checked) =>
    setForm((f) => {
      const groupValues = group.permissions.map((p) => p.value)
      const others = f.permissions.filter((p) => !groupValues.includes(p))
      return { ...f, permissions: checked ? [...others, ...groupValues] : others }
    })

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
              <div className="border rounded p-2" style={{ maxHeight: 320, overflowY: 'auto' }}>
                {PERMISSION_GROUPS.map((group) => {
                  const groupValues = group.permissions.map((p) => p.value)
                  const allChecked = groupValues.every((v) => form.permissions.includes(v))
                  return (
                    <div key={group.key} className="mb-3">
                      <CFormCheck
                        id={`perm-group-${group.key}`}
                        className="fw-semibold"
                        label={group.label}
                        checked={allChecked}
                        onChange={(e) => toggleGroup(group, e.target.checked)}
                      />
                      <div className="d-flex flex-wrap gap-3 ms-3 mt-1">
                        {group.permissions.map((p) => (
                          <CFormCheck
                            key={p.value}
                            id={`perm-${p.value}`}
                            label={p.label}
                            checked={form.permissions.includes(p.value)}
                            onChange={() => togglePermission(p.value)}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
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
