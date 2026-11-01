/**
 * UserForm
 *
 * Modal create/edit form for a system user. When `user` is provided the form is
 * in edit mode (password optional); otherwise it creates a new user. Roles are
 * populated from the Roles module.
 *
 * @module views/admin/UserForm
 */

import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CInputGroup,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'
import { Eye, EyeOff } from 'lucide-react'

import { useCreateUser, useUpdateUser } from '../../hooks/useUsers'
import { useRoles } from '../../hooks/useRoles'
import { useAuth } from '../../context/AuthContext'
import PhoneInput from '../../components/PhoneInput'
import RoleSelector, { toRoleIds, validateRoleSelection } from '../../components/RoleSelector'

const emptyForm = {
  first_name: '',
  middle_name: '',
  last_name: '',
  email: '',
  phone: '',
  roles: [],
  id_number: '',
  password: '',
}

const toForm = (u) => ({
  first_name: u.first_name || '',
  middle_name: u.middle_name || '',
  last_name: u.last_name || '',
  email: u.email || '',
  phone: u.phone || '',
  roles: (u.roles ?? []).map(String),
  id_number: u.id_number || '',
  password: '',
})

const UserForm = ({ visible, user, onClose }) => {
  const isEdit = Boolean(user)
  const createMutation = useCreateUser()
  const updateMutation = useUpdateUser()
  const saving = createMutation.isPending || updateMutation.isPending

  const { data: roles = [] } = useRoles()
  const { hasPermission } = useAuth()
  // Only a Super Admin (wildcard `'*'` permission) may create/promote/demote another Super Admin.
  const canAssignSuperAdmin = hasPermission('*')

  const isSuperAdminRole = (r) => Array.isArray(r.permissions) && r.permissions.includes('*')
  const userRoleIds = (user?.roles ?? []).map(Number)
  const targetIsCurrentSuperAdmin =
    isEdit && roles.some((r) => userRoleIds.includes(Number(r.id)) && isSuperAdminRole(r))
  const roleLocked = targetIsCurrentSuperAdmin && !canAssignSuperAdmin
  const assignableRoles = roles.filter(
    (r) =>
      canAssignSuperAdmin ||
      !isSuperAdminRole(r) ||
      (roleLocked && userRoleIds.includes(Number(r.id))),
  )

  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (visible) {
      setForm(user ? toForm(user) : emptyForm)
      setError(null)
      setShowPassword(false)
    }
  }, [visible, user])

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const roleError = validateRoleSelection(form.roles, roles)
    if (roleError) {
      setError({ message: roleError })
      return
    }

    const base = {
      first_name: form.first_name.trim(),
      middle_name: form.middle_name.trim() || null,
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      roles: toRoleIds(form.roles),
      id_number: form.id_number.trim() || null,
    }

    try {
      if (isEdit) {
        const payload = { ...base }
        if (form.password.trim()) payload.password = form.password
        await updateMutation.mutateAsync({ id: user.id, payload })
      } else {
        await createMutation.mutateAsync({ ...base, password: form.password })
      }
      onClose()
    } catch (err) {
      setError(err)
    }
  }

  return (
    <CModal visible={visible} onClose={onClose} alignment="center" size="lg">
      <CForm onSubmit={handleSubmit}>
        <CModalHeader>
          <CModalTitle>{isEdit ? 'Edit User' : 'New User'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError(null)}>
              <div>{error.message || 'Failed to save user.'}</div>
              {Array.isArray(error.data?.errors) && (
                <ul className="mb-0 mt-2">
                  {error.data.errors.map((m, i) => (
                    <li key={i}>{typeof m === 'string' ? m : m.message}</li>
                  ))}
                </ul>
              )}
            </CAlert>
          )}
          <CRow className="g-3">
            <CCol md={4}>
              <CFormLabel>First name <span className="text-danger">*</span></CFormLabel>
              <CFormInput
                value={form.first_name}
                onChange={setField('first_name')}
                maxLength={100}
                required
              />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Middle name</CFormLabel>
              <CFormInput
                value={form.middle_name}
                onChange={setField('middle_name')}
                maxLength={100}
              />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Last name <span className="text-danger">*</span></CFormLabel>
              <CFormInput
                value={form.last_name}
                onChange={setField('last_name')}
                maxLength={100}
                required
              />
            </CCol>

            <CCol md={6}>
              <CFormLabel>Email <span className="text-danger">*</span></CFormLabel>
              <CFormInput type="email" value={form.email} onChange={setField('email')} required />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Phone</CFormLabel>
              <PhoneInput
                value={form.phone}
                onChange={(phone) => setForm((f) => ({ ...f, phone }))}
                placeholder="712345678"
              />
            </CCol>

            <CCol md={4}>
              <CFormLabel>ID number</CFormLabel>
              <CFormInput
                value={form.id_number}
                onChange={setField('id_number')}
                maxLength={50}
              />
            </CCol>
            <RoleSelector
              roles={assignableRoles}
              value={form.roles}
              onChange={(nextRoles) => setForm((f) => ({ ...f, roles: nextRoles }))}
              disabled={roleLocked}
              md={8}
            />
            {roleLocked && (
              <CCol xs={12}>
                <div className="form-text mt-0">Only a Super Admin can change a Super Admin's roles.</div>
              </CCol>
            )}
            <CCol xs={12} md={6}>
              <CFormLabel>{isEdit ? 'New password' : <>Password <span className="text-danger">*</span></>}</CFormLabel>
              <CInputGroup>
                <CFormInput
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={setField('password')}
                  required={!isEdit}
                  autoComplete="new-password"
                  placeholder={isEdit ? 'Leave blank to keep' : ''}
                />
                <CButton
                  type="button"
                  color="secondary"
                  variant="outline"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                </CButton>
              </CInputGroup>
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </CButton>
          <CButton color="primary" type="submit" disabled={saving}>
            {saving && <CSpinner size="sm" className="me-2" />}
            {isEdit ? 'Save Changes' : 'Create User'}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

UserForm.propTypes = {
  visible: PropTypes.bool.isRequired,
  user: PropTypes.object,
  onClose: PropTypes.func.isRequired,
}

UserForm.defaultProps = {
  user: null,
}

export default UserForm
