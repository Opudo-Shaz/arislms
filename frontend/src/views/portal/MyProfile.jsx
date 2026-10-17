/**
 * Client portal: profile. Identity, income and KYC details are read-only
 * (staff-managed); the client can update their contact details.
 *
 * @component
 */

import React, { useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CRow,
  CSpinner,
} from '@coreui/react'

import StatusBadge from '../../components/StatusBadge'
import PhoneInput from '../../components/PhoneInput'
import MyKycDocuments from './MyKycDocuments'
import { usePortalMe, useUpdatePortalMe } from '../../hooks/usePortal'
import { CLIENT_STATUS, KYC_STATUS } from '../../constants/enums'
import { formatDate, formatDateTime } from '../../utils/format'
import toast from '../../utils/toast'

const Item = ({ label, children }) => (
  <CCol xs={12} sm={6} className="mb-3">
    <div className="text-body-secondary small">{label}</div>
    <div>{children || '—'}</div>
  </CCol>
)

const formatAddress = (address) => {
  if (!address || typeof address !== 'object') return null
  return [address.street, address.city, address.county || address.state, address.country].filter(Boolean).join(', ')
}

const fromProfile = (me) => ({
  email: me.email || '',
  secondaryPhone: me.secondaryPhone || '',
  preferredContactMethod: me.preferredContactMethod || '',
})

/** Editable contact details. Keyed on the saved values so it re-seeds after a save. */
const ContactForm = ({ me }) => {
  const update = useUpdatePortalMe()
  const [form, setForm] = useState(() => fromProfile(me))
  const [formError, setFormError] = useState(null)

  const saved = fromProfile(me)
  const dirty = Object.keys(saved).some((k) => form[k] !== saved[k])
  const digits = (s) => String(s || '').replace(/\D/g, '')
  // Compare the last 9 digits so 07xx / 7xx / +2547xx forms of the same number match.
  const sameAsPrimary = Boolean(form.secondaryPhone.trim()) &&
    digits(form.secondaryPhone).slice(-9) === digits(me.phone).slice(-9)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)
    if (sameAsPrimary) return
    try {
      await update.mutateAsync({
        email: form.email.trim() || null,
        secondaryPhone: form.secondaryPhone.trim() || null,
        preferredContactMethod: form.preferredContactMethod || null,
      })
      toast.success('Contact details updated')
    } catch (err) {
      const fieldErrors = err?.data?.errors
      setFormError(fieldErrors?.length ? fieldErrors.map((f) => f.message).join(' ') : err?.message || 'Could not save your changes.')
    }
  }

  return (
    <CForm onSubmit={handleSubmit}>
      {formError ? <CAlert color="danger" dismissible onClose={() => setFormError(null)}>{formError}</CAlert> : null}
      <div className="mb-3">
        <CFormLabel htmlFor="pf-email">Email</CFormLabel>
        <CFormInput
          id="pf-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <div className="form-text">You can receive sign-in codes here instead of SMS.</div>
      </div>
      <div className="mb-3">
        <CFormLabel htmlFor="pf-phone2">Alternative phone</CFormLabel>
        <PhoneInput
          id="pf-phone2"
          value={form.secondaryPhone}
          onChange={(secondaryPhone) => setForm((f) => ({ ...f, secondaryPhone }))}
          invalid={sameAsPrimary}
          placeholder="712345678"
        />
        {sameAsPrimary && (
          <div className="invalid-feedback d-block">Must be different from your sign-in phone number.</div>
        )}
      </div>
      <div className="mb-4">
        <CFormLabel htmlFor="pf-contact">Preferred contact method</CFormLabel>
        <CFormSelect
          id="pf-contact"
          value={form.preferredContactMethod}
          onChange={(e) => setForm((f) => ({ ...f, preferredContactMethod: e.target.value }))}
        >
          <option value="">No preference</option>
          <option value="sms">SMS</option>
          <option value="email">Email</option>
          <option value="phone">Phone call</option>
        </CFormSelect>
      </div>
      <CButton color="primary" type="submit" disabled={!dirty || sameAsPrimary || update.isPending}>
        {update.isPending ? <CSpinner size="sm" /> : 'Save changes'}
      </CButton>
    </CForm>
  )
}

const MyProfile = () => {
  const { data: me, isLoading, error } = usePortalMe()

  if (isLoading) return <div className="text-center py-5"><CSpinner color="primary" /></div>
  if (error || !me) return <CAlert color="danger">{error?.message || 'Could not load your profile.'}</CAlert>

  return (
    <CRow className="g-3">
      <CCol lg={7}>
        <CCard className="h-100">
          <CCardHeader className="d-flex align-items-center gap-2">
            <strong>{me.firstName} {me.lastName}</strong>
            <span className="ms-auto small text-body-secondary">Account {me.accountNumber}</span>
          </CCardHeader>
          <CCardBody>
            <CRow>
              <Item label="Account status"><StatusBadge enumDef={CLIENT_STATUS} value={me.status} /></Item>
              <Item label="Identity verification (KYC)">
                <StatusBadge enumDef={KYC_STATUS} value={me.kycStatus} />
                {me.kycVerifiedAt ? <span className="small text-body-secondary ms-2">{formatDate(me.kycVerifiedAt)}</span> : null}
              </Item>
              <Item label="Phone (sign-in number)">{me.phone}</Item>
              <Item label="Date of birth">{me.dateOfBirth ? formatDate(me.dateOfBirth) : null}</Item>
              <Item label="ID document">{me.idDocumentType}</Item>
              <Item label="Occupation">{[me.occupation, me.employer].filter(Boolean).join(' · ')}</Item>
              <Item label="Address">{formatAddress(me.address)}</Item>
              <Item label="Loans repaid">{me.loanTenure ?? 0}</Item>
              <Item label="Last sign-in">{me.lastLoginAt ? formatDateTime(me.lastLoginAt) : null}</Item>
            </CRow>
            <div className="small text-body-secondary">
              To change your name, ID, sign-in phone number or income details, please contact support or visit a branch.
            </div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol lg={5}>
        <CCard className="h-100">
          <CCardHeader><strong>Contact details</strong></CCardHeader>
          <CCardBody>
            <ContactForm key={JSON.stringify(fromProfile(me))} me={me} />
          </CCardBody>
        </CCard>
      </CCol>
      <CCol xs={12}>
        <MyKycDocuments me={me} />
      </CCol>
    </CRow>
  )
}

export default MyProfile
