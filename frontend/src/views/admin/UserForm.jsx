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
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'

import { useCreateUser, useUpdateUser } from '../../hooks/useUsers'
import { useRoles } from '../../hooks/useRoles'

const emptyForm = {
  first_name: '',
  middle_name: '',
  last_name: '',
  email: '',
  phone: '',
  role: '',
  id_number: '',
  password: '',
}

const toForm = (u) => ({
  first_name: u.first_name || '',
  middle_name: u.middle_name || '',
  last_name: u.last_name || '',
  email: u.email || '',
  phone: u.phone || '',
  role: u.role ?? '',
  id_number: u.id_number || '',
  password: '',
})

const UserForm = ({ visible, user, onClose }) => {
  const isEdit = Boolean(user)
  const createMutation = useCreateUser()
  const updateMutation = useUpdateUser()
  const saving = createMutation.isPending || updateMutation.isPending

  const { data: roles = [] } = useRoles()

  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (visible) {
      setForm(user ? toForm(user) : emptyForm)
      setError(null)
    }
  }, [visible, user])

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const base = {
      first_name: form.first_name.trim(),
      middle_name: form.middle_name.trim() || null,
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      role: Number(form.role),
      id_number: form.id_number.trim(),
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
              <CFormLabel>First name *</CFormLabel>
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
              <CFormLabel>Last name *</CFormLabel>
              <CFormInput
                value={form.last_name}
                onChange={setField('last_name')}
                maxLength={100}
                required
              />
            </CCol>

            <CCol md={6}>
              <CFormLabel>Email *</CFormLabel>
              <CFormInput type="email" value={form.email} onChange={setField('email')} required />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Phone</CFormLabel>
              <CFormInput value={form.phone} onChange={setField('phone')} placeholder="1234567" />
            </CCol>

            <CCol md={4}>
              <CFormLabel>ID number *</CFormLabel>
              <CFormInput
                value={form.id_number}
                onChange={setField('id_number')}
                maxLength={50}
                required
              />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Role *</CFormLabel>
              <CFormSelect value={form.role} onChange={setField('role')} required>
                <option value="">Select role…</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={4}>
              <CFormLabel>{isEdit ? 'New password' : 'Password *'}</CFormLabel>
              <CFormInput
                type="password"
                value={form.password}
                onChange={setField('password')}
                required={!isEdit}
                autoComplete="new-password"
                placeholder={isEdit ? 'Leave blank to keep' : ''}
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
