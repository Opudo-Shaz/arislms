/**
 * MemberContributionForm
 *
 * Modal form for recording a member contribution or withdrawal. A balanced
 * journal entry is auto-posted by the backend. When a `clientId` prop is
 * supplied the member is fixed; otherwise a member selector is shown.
 *
 * @module views/memberContributions/MemberContributionForm
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
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'

import { useCreateContribution } from '../../hooks/useMemberContributions'
import { CONTRIBUTION_TYPE } from '../../constants/enums'
import ClientAsyncSelect from '../../components/ClientAsyncSelect'

const today = () => new Date().toISOString().slice(0, 10)

const buildForm = (clientId) => ({
  clientId: clientId ? String(clientId) : '',
  amount: '',
  contributionDate: today(),
  type: 'CONTRIBUTION',
  notes: '',
})

const MemberContributionForm = ({ visible, clientId, onClose }) => {
  const createMutation = useCreateContribution()

  const [form, setForm] = useState(buildForm(clientId))
  const [error, setError] = useState(null)

  useEffect(() => {
    if (visible) {
      setForm(buildForm(clientId))
      setError(null)
    }
  }, [visible, clientId])

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!form.clientId) {
      setError({ message: 'Please select a member.' })
      return
    }
    if (!(Number(form.amount) > 0)) {
      setError({ message: 'Amount must be greater than zero.' })
      return
    }

    const payload = {
      clientId: Number(form.clientId),
      amount: Number(form.amount),
      contributionDate: form.contributionDate || undefined,
      type: form.type,
      notes: form.notes.trim() || null,
    }

    try {
      await createMutation.mutateAsync(payload)
      onClose()
    } catch (err) {
      setError(err)
    }
  }

  return (
    <CModal visible={visible} onClose={onClose} alignment="center">
      <CForm onSubmit={handleSubmit}>
        <CModalHeader>
          <CModalTitle>Record Contribution / Withdrawal</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError(null)}>
              <div>{error.message || 'Failed to record entry.'}</div>
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
            <CCol xs={12}>
              <CFormLabel htmlFor="mc-client-select">Member *</CFormLabel>
              <ClientAsyncSelect
                inputId="mc-client-select"
                value={form.clientId || null}
                onChange={(id) => setForm((f) => ({ ...f, clientId: id != null ? String(id) : '' }))}
                isDisabled={Boolean(clientId)}
              />
            </CCol>

            <CCol md={6}>
              <CFormLabel>Type *</CFormLabel>
              <CFormSelect value={form.type} onChange={setField('type')}>
                <option value="CONTRIBUTION">{CONTRIBUTION_TYPE.labels.CONTRIBUTION}</option>
                <option value="WITHDRAWAL">{CONTRIBUTION_TYPE.labels.WITHDRAWAL}</option>
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Amount *</CFormLabel>
              <CFormInput
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={setField('amount')}
                required
              />
            </CCol>

            <CCol md={6}>
              <CFormLabel>Date</CFormLabel>
              <CFormInput
                type="date"
                value={form.contributionDate}
                onChange={setField('contributionDate')}
              />
            </CCol>

            <CCol xs={12}>
              <CFormLabel>Notes</CFormLabel>
              <CFormTextarea
                rows={2}
                value={form.notes}
                onChange={setField('notes')}
                maxLength={500}
              />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            onClick={onClose}
            disabled={createMutation.isPending}
          >
            Cancel
          </CButton>
          <CButton color="primary" type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending && <CSpinner size="sm" className="me-2" />}
            Record
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

MemberContributionForm.propTypes = {
  visible: PropTypes.bool.isRequired,
  clientId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onClose: PropTypes.func.isRequired,
}

MemberContributionForm.defaultProps = {
  clientId: null,
}

export default MemberContributionForm
