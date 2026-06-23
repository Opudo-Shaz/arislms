/**
 * ChartOfAccountForm
 *
 * Modal create/edit form for a chart-of-accounts entry. When `account` is
 * provided the form is in edit mode; otherwise it creates a new account.
 *
 * @module views/accounting/ChartOfAccountForm
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
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'

import { useCreateAccount, useUpdateAccount } from '../../hooks/useChartOfAccounts'
import { ACCOUNT_TYPE, NORMAL_BALANCE } from '../../constants/enums'

const emptyForm = {
  code: '',
  name: '',
  type: 'ASSET',
  normalBalance: 'DEBIT',
  description: '',
  isActive: true,
}

const toForm = (a) => ({
  code: a.code || '',
  name: a.name || '',
  type: a.type || 'ASSET',
  normalBalance: a.normalBalance || 'DEBIT',
  description: a.description || '',
  isActive: a.isActive !== false,
})

const ChartOfAccountForm = ({ visible, account, onClose }) => {
  const isEdit = Boolean(account)
  const createMutation = useCreateAccount()
  const updateMutation = useUpdateAccount()
  const saving = createMutation.isPending || updateMutation.isPending

  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (visible) {
      setForm(account ? toForm(account) : emptyForm)
      setError(null)
    }
  }, [visible, account])

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      if (isEdit) {
        const payload = {
          name: form.name.trim(),
          type: form.type,
          normalBalance: form.normalBalance,
          description: form.description.trim() || null,
          isActive: form.isActive,
        }
        await updateMutation.mutateAsync({ id: account.id, payload })
      } else {
        const payload = {
          code: form.code.trim(),
          name: form.name.trim(),
          type: form.type,
          normalBalance: form.normalBalance,
          description: form.description.trim() || null,
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
          <CModalTitle>{isEdit ? 'Edit Account' : 'New Account'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError(null)}>
              <div>{error.message || 'Failed to save account.'}</div>
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
              <CFormLabel>Code *</CFormLabel>
              <CFormInput
                value={form.code}
                onChange={setField('code')}
                maxLength={20}
                required
                disabled={isEdit}
              />
            </CCol>
            <CCol md={8}>
              <CFormLabel>Name *</CFormLabel>
              <CFormInput value={form.name} onChange={setField('name')} maxLength={120} required />
            </CCol>

            <CCol md={6}>
              <CFormLabel>Type *</CFormLabel>
              <CFormSelect value={form.type} onChange={setField('type')}>
                {ACCOUNT_TYPE.values.map((v) => (
                  <option key={v} value={v}>
                    {ACCOUNT_TYPE.labels[v]}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Normal balance *</CFormLabel>
              <CFormSelect value={form.normalBalance} onChange={setField('normalBalance')}>
                {NORMAL_BALANCE.values.map((v) => (
                  <option key={v} value={v}>
                    {NORMAL_BALANCE.labels[v]}
                  </option>
                ))}
              </CFormSelect>
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

            {isEdit && (
              <CCol xs={12}>
                <CFormCheck
                  label="Active"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
              </CCol>
            )}
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </CButton>
          <CButton color="primary" type="submit" disabled={saving}>
            {saving && <CSpinner size="sm" className="me-2" />}
            {isEdit ? 'Save Changes' : 'Create Account'}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

ChartOfAccountForm.propTypes = {
  visible: PropTypes.bool.isRequired,
  account: PropTypes.object,
  onClose: PropTypes.func.isRequired,
}

ChartOfAccountForm.defaultProps = {
  account: null,
}

export default ChartOfAccountForm
