/**
 * ClientForm
 *
 * Create or edit a client. In edit mode the form is prefilled from the
 * client detail query. Submits to the create/update mutations and surfaces
 * backend validation errors.
 *
 * @module views/clients/ClientForm
 */

import React, { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
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
  CFormTextarea,
  CRow,
  CSpinner,
} from '@coreui/react'

import { useClient, useCreateClient, useUpdateClient } from '../../hooks/useClients'
import { useClientRegistrationConfig } from '../../hooks/useClientRegistrationLinks'
import clientApi from '../../api/clientApi'
import { useAuth } from '../../context/AuthContext'

const GENDERS = ['male', 'female', 'other']
const CONTACT_METHODS = ['email', 'phone', 'sms']
const ID_DOC_TYPES = ['national_id', 'passport', 'driving_license', 'alien_id']

const EAC_COUNTRIES = [
  'Kenya',
  'Uganda',
  'Tanzania',
  'Rwanda',
  'Burundi',
  'South Sudan',
  'Democratic Republic of Congo',
  'Somalia',
]

const adultCutoff = () => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 18)
  return d.toISOString().slice(0, 10)
}

const emptyForm = {
  accountNumber: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  secondaryPhone: '',
  dateOfBirth: '',
  gender: 'male',
  occupation: '',
  employer: '',
  monthlyIncome: '',
  street: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'Kenya',
  idDocumentType: 'national_id',
  idDocumentNumber: '',
  preferredContactMethod: '',
  notes: '',
}

/** Map a client API object into the flat form state. */
const toForm = (client) => ({
  accountNumber: client.accountNumber || '',
  firstName: client.firstName || '',
  lastName: client.lastName || '',
  email: client.email || '',
  phone: client.phone || '',
  secondaryPhone: client.secondaryPhone || '',
  dateOfBirth: client.dateOfBirth ? String(client.dateOfBirth).slice(0, 10) : '',
  gender: client.gender || 'male',
  occupation: client.occupation || '',
  employer: client.employer || '',
  monthlyIncome: client.monthlyIncome ?? '',
  street: client.address?.street || '',
  city: client.address?.city || '',
  state: client.address?.state || '',
  postalCode: client.address?.postalCode || '',
  country: client.address?.country || 'Kenya',
  idDocumentType: client.idDocumentType || 'national_id',
  idDocumentNumber: client.idDocumentNumber || '',
  preferredContactMethod: client.preferredContactMethod || '',
  notes: client.notes || '',
})

/** Build the API payload from form state. Empty optional fields are dropped. */
const toPayload = (form) => {
  const payload = {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    phone: form.phone.trim(),
    gender: form.gender,
    occupation: form.occupation.trim(),
    monthlyIncome: Number(form.monthlyIncome),
    address: {
      street: form.street.trim(),
      city: form.city.trim(),
      state: form.state.trim() || null,
      postalCode: form.postalCode.trim() || null,
      country: form.country.trim(),
    },
    idDocumentType: form.idDocumentType.trim(),
    idDocumentNumber: form.idDocumentNumber.trim(),
  }
  payload.email = form.email.trim() || null
  if (form.accountNumber.trim()) payload.accountNumber = form.accountNumber.trim()
  if (form.secondaryPhone.trim()) payload.secondaryPhone = form.secondaryPhone.trim()
  if (form.dateOfBirth) payload.dateOfBirth = form.dateOfBirth
  if (form.employer.trim()) payload.employer = form.employer.trim()
  if (form.preferredContactMethod) payload.preferredContactMethod = form.preferredContactMethod
  if (form.notes.trim()) payload.notes = form.notes.trim()
  return payload
}

const ClientForm = () => {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const canSubmit = hasPermission(isEdit ? 'clients:update' : 'clients:create')

  const { data: client, isLoading: loadingClient } = useClient(id)
  const createMutation = useCreateClient()
  const updateMutation = useUpdateClient()
  const saving = createMutation.isPending || updateMutation.isPending

  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState(null)

  // Phone verification, enforced server-side when client.registration.enable_otp is on.
  const { data: regConfig } = useClientRegistrationConfig(!isEdit)
  const otpRequired = !isEdit && Boolean(regConfig?.otpRequired)
  const [verification, setVerification] = useState(null) // { token, phone }
  const [otp, setOtp] = useState({ sent: false, code: '', busy: false, error: '' })
  const phoneVerified = Boolean(verification && verification.phone === form.phone.trim())

  const patchOtp = (patch) => setOtp((o) => ({ ...o, ...patch }))
  const otpErrorMessage = (err) => err.data?.errors?.[0]?.message || err.message

  const sendOtp = async () => {
    patchOtp({ busy: true, error: '' })
    try {
      await clientApi.requestPhoneOtp({
        phone: form.phone.trim(),
        name: `${form.firstName} ${form.lastName}`.trim() || undefined,
      })
      patchOtp({ sent: true, busy: false })
    } catch (err) {
      patchOtp({ busy: false, error: otpErrorMessage(err) })
    }
  }

  const confirmOtp = async () => {
    patchOtp({ busy: true, error: '' })
    try {
      const res = await clientApi.verifyPhoneOtp({ phone: form.phone.trim(), code: otp.code.trim() })
      setVerification({ token: res.verificationToken, phone: form.phone.trim() })
      patchOtp({ busy: false, code: '' })
    } catch (err) {
      patchOtp({ busy: false, error: otpErrorMessage(err) })
    }
  }

  useEffect(() => {
    if (isEdit && client) setForm(toForm(client))
  }, [isEdit, client])

  if (!canSubmit) return <Navigate to="/unauthorized" replace />

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrors(null)
    if (otpRequired && !phoneVerified) {
      setErrors({ message: 'Verify the client\u2019s phone number before creating the client.' })
      return
    }
    if (form.dateOfBirth && form.dateOfBirth > adultCutoff()) {
      setErrors({ message: 'Client must be at least 18 years old.' })
      return
    }
    const payload = toPayload(form)
    if (otpRequired) payload.phoneVerificationToken = verification.token
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id, payload })
        navigate(`/clients/${id}`)
      } else {
        const created = await createMutation.mutateAsync(payload)
        navigate(created?.id ? `/clients/${created.id}` : '/clients')
      }
    } catch (err) {
      setErrors(err)
    }
  }

  if (isEdit && loadingClient) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )
  }

  return (
    <CCard className="mb-4">
      <CCardHeader>
        <strong>{isEdit ? 'Edit Client' : 'New Client'}</strong>
      </CCardHeader>
      <CCardBody>
        {errors && (
          <CAlert color="danger" dismissible onClose={() => setErrors(null)}>
            <div>{errors.message || 'Failed to save client.'}</div>
            {Array.isArray(errors.data?.errors) && (
              <ul className="mb-0 mt-2">
                {errors.data.errors.map((m, i) => (
                  <li key={i}>{typeof m === 'string' ? m : m.message}</li>
                ))}
              </ul>
            )}
          </CAlert>
        )}

        <CForm onSubmit={handleSubmit}>
          <CRow className="g-3">
            <CCol md={6}>
              <CFormLabel>First name <span className="text-danger">*</span></CFormLabel>
              <CFormInput value={form.firstName} onChange={setField('firstName')} required />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Last name <span className="text-danger">*</span></CFormLabel>
              <CFormInput value={form.lastName} onChange={setField('lastName')} required />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Email</CFormLabel>
              <CFormInput type="email" value={form.email} onChange={setField('email')} />
            </CCol>
            <CCol md={3}>
              <CFormLabel>Phone <span className="text-danger">*</span></CFormLabel>
              <CFormInput value={form.phone} onChange={setField('phone')} required />
            </CCol>
            <CCol md={3}>
              <CFormLabel>Secondary phone</CFormLabel>
              <CFormInput value={form.secondaryPhone} onChange={setField('secondaryPhone')} />
            </CCol>
            <CCol md={3}>
              <CFormLabel>Account number</CFormLabel>
              <CFormInput value={form.accountNumber} onChange={setField('accountNumber')} />
            </CCol>
            <CCol md={3}>
              <CFormLabel>Date of birth</CFormLabel>
              <CFormInput
                type="date"
                max={adultCutoff()}
                value={form.dateOfBirth}
                onChange={setField('dateOfBirth')}
              />
            </CCol>
            <CCol md={3}>
              <CFormLabel>Gender <span className="text-danger">*</span></CFormLabel>
              <CFormSelect value={form.gender} onChange={setField('gender')}>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={3}>
              <CFormLabel>Preferred contact</CFormLabel>
              <CFormSelect
                value={form.preferredContactMethod}
                onChange={setField('preferredContactMethod')}
              >
                <option value="">—</option>
                {CONTACT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </option>
                ))}
              </CFormSelect>
            </CCol>

            <CCol md={4}>
              <CFormLabel>Occupation <span className="text-danger">*</span></CFormLabel>
              <CFormInput value={form.occupation} onChange={setField('occupation')} required />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Employer</CFormLabel>
              <CFormInput value={form.employer} onChange={setField('employer')} />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Monthly income <span className="text-danger">*</span></CFormLabel>
              <CFormInput
                type="number"
                min="0"
                step="0.01"
                value={form.monthlyIncome}
                onChange={setField('monthlyIncome')}
                required
              />
            </CCol>

            <CCol xs={12}>
              <hr className="mb-0" />
              <span className="text-body-secondary small">Address</span>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Street <span className="text-danger">*</span></CFormLabel>
              <CFormInput value={form.street} onChange={setField('street')} required />
            </CCol>
            <CCol md={6}>
              <CFormLabel>City <span className="text-danger">*</span></CFormLabel>
              <CFormInput value={form.city} onChange={setField('city')} required />
            </CCol>
            <CCol md={4}>
              <CFormLabel>State / County</CFormLabel>
              <CFormInput value={form.state} onChange={setField('state')} />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Postal code</CFormLabel>
              <CFormInput value={form.postalCode} onChange={setField('postalCode')} />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Country <span className="text-danger">*</span></CFormLabel>
              <CFormSelect value={form.country} onChange={setField('country')} required>
                {EAC_COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </CFormSelect>
            </CCol>

            <CCol xs={12}>
              <hr className="mb-0" />
              <span className="text-body-secondary small">Identification</span>
            </CCol>
            <CCol md={6}>
              <CFormLabel>ID document type <span className="text-danger">*</span></CFormLabel>
              <CFormSelect value={form.idDocumentType} onChange={setField('idDocumentType')}>
                {ID_DOC_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t
                      .split('_')
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(' ')}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              <CFormLabel>ID document number <span className="text-danger">*</span></CFormLabel>
              <CFormInput
                value={form.idDocumentNumber}
                onChange={setField('idDocumentNumber')}
                required
              />
            </CCol>

            <CCol xs={12}>
              <CFormLabel>Notes</CFormLabel>
              <CFormTextarea rows={3} value={form.notes} onChange={setField('notes')} />
            </CCol>

            {otpRequired && (
              <>
                <CCol xs={12}>
                  <hr className="mb-0" />
                  <span className="text-body-secondary small">Phone verification</span>
                </CCol>
                <CCol xs={12}>
                  {phoneVerified ? (
                    <CAlert color="success" className="mb-0">
                      {form.phone} is verified.
                    </CAlert>
                  ) : (
                    <>
                      <div className="text-body-secondary small mb-2">
                        Send a one-time code by SMS to the client and enter it here to confirm the phone number.
                        Changing the phone number requires verifying again.
                      </div>
                      <CRow className="g-2 align-items-end">
                        <CCol md="auto">
                          <CButton
                            type="button"
                            color="primary"
                            variant="outline"
                            onClick={sendOtp}
                            disabled={otp.busy || !form.phone.trim()}
                          >
                            {otp.sent ? 'Resend code' : 'Send code'}
                          </CButton>
                        </CCol>
                        {otp.sent && (
                          <>
                            <CCol md={3}>
                              <CFormInput
                                value={otp.code}
                                onChange={(e) => patchOtp({ code: e.target.value })}
                                placeholder="Verification code"
                                inputMode="numeric"
                                maxLength={10}
                              />
                            </CCol>
                            <CCol md="auto">
                              <CButton
                                type="button"
                                color="primary"
                                onClick={confirmOtp}
                                disabled={otp.busy || otp.code.trim().length < 4}
                              >
                                Verify
                              </CButton>
                            </CCol>
                          </>
                        )}
                      </CRow>
                      {otp.error && <div className="text-danger small mt-2">{otp.error}</div>}
                    </>
                  )}
                </CCol>
              </>
            )}
          </CRow>

          <div className="d-flex gap-2 mt-4">
            <CButton type="submit" color="primary" disabled={saving}>
              {saving && <CSpinner size="sm" className="me-2" />}
              {isEdit ? 'Save Changes' : 'Create Client'}
            </CButton>
            <CButton
              type="button"
              color="secondary"
              variant="outline"
              onClick={() => navigate(isEdit ? `/clients/${id}` : '/clients')}
              disabled={saving}
            >
              Cancel
            </CButton>
          </div>
        </CForm>
      </CCardBody>
    </CCard>
  )
}

export default ClientForm
