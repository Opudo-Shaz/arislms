/**
 * InviteUserModal
 *
 * Sends an invite-only registration link. Requires email, a role, and at
 * least one of first/last name; phone is optional. On success shows the
 * invite link (and a warning if the email channel is disabled system-wide,
 * since the invitee won't have received an email in that case).
 *
 * @module views/admin/InviteUserModal
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
  CInputGroup,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'

import { useCreateInvitation } from '../../hooks/useInvitations'
import { useRoles } from '../../hooks/useRoles'
import { useAuth } from '../../context/AuthContext'

const emptyForm = {
  email: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  phone: '',
  role: '',
}

const InviteUserModal = ({ visible, onClose }) => {
  const createMutation = useCreateInvitation()
  const { data: roles = [] } = useRoles()
  const { hasPermission } = useAuth()
  // Only a Super Admin (wildcard `'*'` permission) may invite another Super
  // Admin. Determined from each role's own permissions, not a hardcoded role
  // id, since that id can differ across environments.
  const canAssignSuperAdmin = hasPermission('*')
  const assignableRoles = roles.filter(
    (r) => canAssignSuperAdmin || !(Array.isArray(r.permissions) && r.permissions.includes('*')),
  )

  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (visible) {
      setForm(emptyForm)
      setError(null)
      setResult(null)
      setCopied(false)
    }
  }, [visible])

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!form.first_name.trim() && !form.last_name.trim()) {
      setError({ message: 'Provide at least a first or last name.' })
      return
    }

    const payload = {
      email: form.email.trim(),
      role: Number(form.role),
      ...(form.first_name.trim() ? { first_name: form.first_name.trim() } : {}),
      ...(form.middle_name.trim() ? { middle_name: form.middle_name.trim() } : {}),
      ...(form.last_name.trim() ? { last_name: form.last_name.trim() } : {}),
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
    }

    try {
      const res = await createMutation.mutateAsync(payload)
      setResult(res)
    } catch (err) {
      setError(err)
    }
  }

  const copyLink = async () => {
    if (!result?.inviteUrl) return
    try {
      await navigator.clipboard.writeText(result.inviteUrl)
      setCopied(true)
    } catch {
      // Clipboard API unavailable — user can still select/copy manually.
    }
  }

  const handleClose = () => {
    setResult(null)
    onClose()
  }

  return (
    <CModal visible={visible} onClose={handleClose} alignment="center" size="lg">
      {result ? (
        <>
          <CModalHeader>
            <CModalTitle>Invitation sent</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CAlert color="success">
              Invitation created for <strong>{form.email}</strong>.
            </CAlert>
            {result.warnings?.map((w, i) => (
              <CAlert key={i} color="warning">
                {w}
              </CAlert>
            ))}
            <CFormLabel>Registration link</CFormLabel>
            <CInputGroup className="mb-2">
              <CFormInput readOnly value={result.inviteUrl || ''} />
              <CButton color="secondary" variant="outline" onClick={copyLink}>
                {copied ? 'Copied!' : 'Copy'}
              </CButton>
            </CInputGroup>
            <div className="text-body-secondary small">
              This link expires in 72 hours. Share it manually if the invitee didn&apos;t receive it by email.
            </div>
          </CModalBody>
          <CModalFooter>
            <CButton color="primary" onClick={handleClose}>
              Done
            </CButton>
          </CModalFooter>
        </>
      ) : (
        <CForm onSubmit={handleSubmit}>
          <CModalHeader>
            <CModalTitle>Invite User</CModalTitle>
          </CModalHeader>
          <CModalBody>
            {error && (
              <CAlert color="danger" dismissible onClose={() => setError(null)}>
                <div>{error.message || 'Failed to send invitation.'}</div>
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
              <CCol md={6}>
                <CFormLabel>Email *</CFormLabel>
                <CFormInput type="email" value={form.email} onChange={setField('email')} required />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Role *</CFormLabel>
                <CFormSelect value={form.role} onChange={setField('role')} required>
                  <option value="">Select role…</option>
                  {assignableRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>

              <CCol md={4}>
                <CFormLabel>First name</CFormLabel>
                <CFormInput value={form.first_name} onChange={setField('first_name')} maxLength={100} />
              </CCol>
              <CCol md={4}>
                <CFormLabel>Middle name</CFormLabel>
                <CFormInput value={form.middle_name} onChange={setField('middle_name')} maxLength={100} />
              </CCol>
              <CCol md={4}>
                <CFormLabel>Last name</CFormLabel>
                <CFormInput value={form.last_name} onChange={setField('last_name')} maxLength={100} />
              </CCol>

              <CCol md={6}>
                <CFormLabel>Phone</CFormLabel>
                <CFormInput value={form.phone} onChange={setField('phone')} placeholder="1234567 (optional)" />
              </CCol>
            </CRow>
            <div className="text-body-secondary small mt-3">
              Provide at least a first or last name. The invitee fills in the rest (password,
              remaining name, phone if not given here) when they open the link.
            </div>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={handleClose} disabled={createMutation.isPending}>
              Cancel
            </CButton>
            <CButton color="primary" type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <CSpinner size="sm" className="me-2" />}
              Send Invite
            </CButton>
          </CModalFooter>
        </CForm>
      )}
    </CModal>
  )
}

InviteUserModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
}

export default InviteUserModal
