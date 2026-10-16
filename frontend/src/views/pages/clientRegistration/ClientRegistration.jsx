/**
 * ClientRegistration
 *
 * Public, multi-step self-registration form reached through an invite-only
 * link (`/register/client?token=...`). Collects the same details as staff
 * enter, plus KYC documents, and submits once at the end. The client is
 * created as pending until staff verify KYC.
 *
 * Text fields are cached in sessionStorage so a reload or a server-side
 * validation error never loses what the applicant typed. Files cannot be
 * cached, so they stay in memory and must be re-selected after a reload.
 *
 * @module views/pages/clientRegistration/ClientRegistration
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormFeedback,
  CProgress,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCloudUpload, cilFile, cilTrash } from '@coreui/icons'

import StatusBadge from '../../../components/StatusBadge'
import { CLIENT_KYC_DOCUMENT_TYPES, DOCUMENT_TYPE } from '../../../constants/enums'
import { useResolveRegistrationLink } from '../../../hooks/useClientRegistrationLinks'
import api from '../../../api/clientRegistrationLinkApi'
import arislmsLogoDefault from '../../../assets/brand/arislms_logo_fit.png'
import arislmsLogoDark from '../../../assets/brand/arislms_logo_dark.png'

const GENDERS = ['male', 'female', 'other']
const CONTACT_METHODS = ['email', 'phone', 'sms']
const ID_DOC_TYPES = ['national_id', 'passport', 'driving_license', 'alien_id']
const COUNTRIES = [
  'Kenya',
  'Uganda',
  'Tanzania',
  'Rwanda',
  'Burundi',
  'South Sudan',
  'Democratic Republic of Congo',
  'Somalia',
]

const MAX_FILE_BYTES = 5 * 1024 * 1024
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

// The server requires a photo plus the document for the chosen ID type (anything else for alien_id).
const ID_TYPE_TO_DOCUMENT_TYPE = {
  national_id: 'national_id',
  passport: 'passport',
  driving_license: 'driving_license',
}
const requiredDocTypes = (idDocumentType) => [
  'client_photo',
  ID_TYPE_TO_DOCUMENT_TYPE[idDocumentType] || 'other',
]
const docLabel = (type) => DOCUMENT_TYPE.labels[type] || type

const emptyForm = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: 'male',
  email: '',
  phone: '',
  secondaryPhone: '',
  street: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'Kenya',
  occupation: '',
  employer: '',
  monthlyIncome: '',
  preferredContactMethod: '',
  idDocumentType: 'national_id',
  idDocumentNumber: '',
}

const STEPS = [
  {
    id: 'personal',
    title: 'Personal details',
    fields: ['firstName', 'lastName', 'dateOfBirth', 'gender', 'email', 'phone', 'secondaryPhone'],
  },
  {
    id: 'address',
    title: 'Address & work',
    fields: ['street', 'city', 'state', 'postalCode', 'country', 'occupation', 'employer', 'monthlyIncome', 'preferredContactMethod'],
  },
  {
    id: 'documents',
    title: 'ID & documents',
    fields: [
      'idDocumentType',
      'idDocumentNumber',
      ...CLIENT_KYC_DOCUMENT_TYPES.map((t) => `files.${t}`),
    ],
  },
  { id: 'verify', title: 'Verify phone', fields: ['phoneVerification'] },
  { id: 'review', title: 'Review & submit', fields: [] },
]

const titleCase = (s) =>
  s
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

const adultCutoff = () => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 18)
  return d.toISOString().slice(0, 10)
}

/** Client-side checks for the fields on one step; mirrors the server's rules. */
const validateFields = (fields, form, files, verified) => {
  const errors = {}
  const required = (key, label) => {
    if (!String(form[key] ?? '').trim()) errors[key] = `${label} is required`
  }

  if (fields.includes('firstName')) {
    if (String(form.firstName).trim().length < 2) errors.firstName = 'First name must be at least 2 characters'
    if (String(form.lastName).trim().length < 2) errors.lastName = 'Last name must be at least 2 characters'
    if (!form.dateOfBirth) errors.dateOfBirth = 'Date of birth is required'
    else if (form.dateOfBirth > adultCutoff()) errors.dateOfBirth = 'You must be at least 18 years old to register'
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address'
    if (form.phone.replace(/\D/g, '').length < 9) errors.phone = 'Enter a valid phone number'
    if (form.secondaryPhone.trim() && form.secondaryPhone.replace(/\D/g, '').length < 9) {
      errors.secondaryPhone = 'Enter a valid phone number'
    }
  }

  if (fields.includes('street')) {
    required('street', 'Street')
    required('city', 'City')
    required('country', 'Country')
    required('occupation', 'Occupation')
    if (form.monthlyIncome === '' || Number(form.monthlyIncome) < 0) {
      errors.monthlyIncome = 'Enter your monthly income (0 or more)'
    }
  }

  if (fields.includes('idDocumentNumber')) {
    required('idDocumentNumber', 'ID number')
    requiredDocTypes(form.idDocumentType).forEach((type) => {
      if (!files[type]) errors[`files.${type}`] = `${docLabel(type)} is required`
    })
  }

  if (fields.includes('phoneVerification') && !verified) {
    errors.phoneVerification = 'Verify your phone number to continue'
  }

  return errors
}

/** Server paths like `address.street` become the flat form keys used here. */
const toLocalField = (path) => (path.startsWith('address.') ? path.slice('address.'.length) : path)

const fileProblem = (file) => {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) return 'Only JPG, PNG, WebP or PDF files are accepted'
  if (file.size > MAX_FILE_BYTES) return 'File must be smaller than 5 MB'
  return null
}

const formatSize = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

/** Thumbnail for images, a file icon for PDFs. Object URLs are released on unmount. */
const DocPreview = ({ file }) => {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!file.type.startsWith('image/')) return undefined
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  return url ? (
    <img src={url} alt={file.name} style={{ width: 44, height: 44, objectFit: 'cover' }} className="rounded border flex-shrink-0" />
  ) : (
    <CIcon icon={cilFile} size="xl" className="text-body-secondary flex-shrink-0" />
  )
}

// Renders a trailing " *" in the label text as a red required marker.
const LabelText = ({ text }) => {
  const match = /^(.*?)\s*\*$/.exec(text)
  return match ? (
    <>
      {match[1]} <span className="text-danger">*</span>
    </>
  ) : (
    text
  )
}

const Field = ({ label, error, children, md = 6 }) => (
  <CCol md={md}>
    <CFormLabel>
      <LabelText text={label} />
    </CFormLabel>
    {children}
    {error && <CFormFeedback invalid style={{ display: 'block' }}>{error}</CFormFeedback>}
  </CCol>
)

const ClientRegistration = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const storageKey = `aris_client_reg_${token.slice(0, 16)}`

  const [colorScheme, setColorScheme] = useState(
    document.documentElement.getAttribute('data-coreui-theme') || 'light',
  )
  useEffect(() => {
    const onChange = () =>
      setColorScheme(document.documentElement.getAttribute('data-coreui-theme') || 'light')
    document.documentElement.addEventListener('ColorSchemeChange', onChange)
    return () => document.documentElement.removeEventListener('ColorSchemeChange', onChange)
  }, [])
  const logo = colorScheme === 'dark' ? arislmsLogoDefault : arislmsLogoDark

  const { data: link, isLoading, error: linkError } = useResolveRegistrationLink(token)
  const steps = useMemo(
    () => STEPS.filter((s) => s.id !== 'verify' || link?.otpRequired),
    [link?.otpRequired],
  )

  // Restore cached text fields (never files) so reloads and server errors keep the input.
  const [saved] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) || 'null') || {}
    } catch {
      return {}
    }
  })
  const [form, setForm] = useState({ ...emptyForm, ...(saved.form || {}) })
  const [stepIndex, setStepIndex] = useState(saved.stepIndex || 0)
  const [verification, setVerification] = useState(saved.verification || null) // { token, phone }
  const [files, setFiles] = useState({}) // keyed by document type
  const [docType, setDocType] = useState('client_photo')
  const [pendingFile, setPendingFile] = useState(null)
  const [docInputKey, setDocInputKey] = useState(0)
  const [docError, setDocError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reference, setReference] = useState(null)

  // OTP step state
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpBusy, setOtpBusy] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (!token || reference) return
    sessionStorage.setItem(storageKey, JSON.stringify({ form, stepIndex, verification }))
  }, [form, stepIndex, verification, storageKey, token, reference])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const step = steps[Math.min(stepIndex, steps.length - 1)]
  const phoneVerified = Boolean(verification && verification.phone === form.phone.trim())

  const setField = (key) => (e) => {
    const { value } = e.target
    setForm((f) => ({ ...f, [key]: value }))
    setFieldErrors((errs) => {
      if (!errs[key]) return errs
      const next = { ...errs }
      delete next[key]
      return next
    })
  }

  // Adding a type that is already in the list replaces it, as the server keeps one document per type.
  const addDocument = () => {
    if (!pendingFile) {
      setDocError('Please choose a file to add.')
      return
    }
    const problem = fileProblem(pendingFile)
    if (problem) {
      setDocError(problem)
      return
    }
    const next = { ...files, [docType]: pendingFile }
    setFiles(next)
    setDocError('')
    setPendingFile(null)
    setDocInputKey((k) => k + 1)
    setFieldErrors((errs) => {
      const rest = { ...errs }
      delete rest[`files.${docType}`]
      return rest
    })
    const missing = requiredDocTypes(form.idDocumentType).find((t) => !next[t])
    if (missing) setDocType(missing)
  }

  const removeDocument = (type) =>
    setFiles((f) => {
      const next = { ...f }
      delete next[type]
      return next
    })

  const goNext = () => {
    const errs = validateFields(step.fields, form, files, phoneVerified)
    setFieldErrors(errs)
    if (Object.keys(errs).length) return
    setFormError('')
    setStepIndex((i) => Math.min(i + 1, steps.length - 1))
  }

  const goBack = () => {
    setFormError('')
    setStepIndex((i) => Math.max(i - 1, 0))
  }

  const requestOtp = async () => {
    setOtpError('')
    setOtpBusy(true)
    try {
      await api.requestPublicOtp(token, {
        phone: form.phone.trim(),
        name: `${form.firstName} ${form.lastName}`.trim() || undefined,
      })
      setOtpSent(true)
      setCooldown(60)
    } catch (err) {
      setOtpError(err.data?.errors?.[0]?.message || err.message || 'Could not send the code.')
    } finally {
      setOtpBusy(false)
    }
  }

  const verifyOtp = async () => {
    setOtpError('')
    setOtpBusy(true)
    try {
      const res = await api.verifyPublicOtp(token, { phone: form.phone.trim(), code: otpCode.trim() })
      setVerification({ token: res.verificationToken, phone: form.phone.trim() })
      setOtpCode('')
      setFieldErrors((errs) => {
        const next = { ...errs }
        delete next.phoneVerification
        return next
      })
    } catch (err) {
      setOtpError(err.data?.errors?.[0]?.message || err.message || 'Could not verify the code.')
    } finally {
      setOtpBusy(false)
    }
  }

  const buildPayload = () => ({
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    ...(form.email.trim() ? { email: form.email.trim() } : {}),
    phone: form.phone.trim(),
    ...(form.secondaryPhone.trim() ? { secondaryPhone: form.secondaryPhone.trim() } : {}),
    dateOfBirth: form.dateOfBirth,
    gender: form.gender,
    occupation: form.occupation.trim(),
    ...(form.employer.trim() ? { employer: form.employer.trim() } : {}),
    monthlyIncome: Number(form.monthlyIncome),
    address: {
      street: form.street.trim(),
      city: form.city.trim(),
      state: form.state.trim() || null,
      postalCode: form.postalCode.trim() || null,
      country: form.country.trim(),
    },
    idDocumentType: form.idDocumentType,
    idDocumentNumber: form.idDocumentNumber.trim(),
    ...(form.preferredContactMethod ? { preferredContactMethod: form.preferredContactMethod } : {}),
    ...(phoneVerified ? { phoneVerificationToken: verification.token } : {}),
  })

  const stepOfField = useCallback(
    (key) => steps.findIndex((s) => s.fields.includes(key)),
    [steps],
  )

  // Earliest step holding any of the given fields, or null when none map to a step.
  const earliestStep = (keys) => {
    const idx = keys.map(stepOfField).filter((i) => i >= 0)
    return idx.length ? Math.min(...idx) : null
  }

  const handleSubmit = async () => {
    // Re-run every step so nothing skipped (e.g. after a reload) reaches the server.
    const errs = validateFields(
      steps.flatMap((s) => s.fields),
      form,
      files,
      phoneVerified || !link?.otpRequired,
    )
    if (Object.keys(errs).length) {
      setFieldErrors(errs)
      setStepIndex(earliestStep(Object.keys(errs)) ?? stepIndex)
      return
    }

    setFormError('')
    setSubmitting(true)
    try {
      const res = await api.submitRegistration(token, buildPayload(), files)
      sessionStorage.removeItem(storageKey)
      setReference(res.referenceNumber)
    } catch (err) {
      const serverErrors = Array.isArray(err.data?.errors) ? err.data.errors : []
      if (serverErrors.length) {
        const mapped = {}
        serverErrors.forEach((e) => {
          mapped[toLocalField(e.field || '')] = e.message
        })
        setFieldErrors(mapped)
        setStepIndex(earliestStep(Object.keys(mapped)) ?? stepIndex)
        setFormError('Please correct the highlighted fields.')
      } else if (err.status === 400 && /verif/i.test(err.message || '')) {
        // The 30-minute verification token expired or no longer matches the phone.
        setVerification(null)
        setStepIndex(earliestStep(['phoneVerification']) ?? stepIndex)
        setFormError(err.message)
      } else {
        setFormError(err.message || 'Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const shell = (children) => (
    <div className="app-view-bg min-vh-100 d-flex flex-row align-items-center py-4">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={9} lg={8}>
            <div className="text-center mb-4">
              <img src={logo} alt="ARISLMS" style={{ height: 48 }} />
            </div>
            <CCard className="p-2 p-md-4">
              <CCardBody>{children}</CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )

  if (!token) {
    return shell(
      <CAlert color="danger" className="mb-0">
        This registration link is not valid. Please use the link you were sent.{' '}
        <Link to="/login">Back to login</Link>
      </CAlert>,
    )
  }

  if (isLoading) {
    return shell(
      <div className="text-center py-4">
        <CSpinner color="primary" />
      </div>,
    )
  }

  if (linkError) {
    return shell(
      <CAlert color="danger" className="mb-0">
        {linkError.message || 'This registration link is not valid.'} Please ask for a new link.
      </CAlert>,
    )
  }

  if (reference) {
    return shell(
      <div className="text-center py-3">
        <h1 className="h4 mb-3">Application received</h1>
        <p className="mb-1">Your reference number is</p>
        <p className="h3 font-monospace mb-3">{reference}</p>
        <p className="text-body-secondary mb-0">
          Your account is pending verification. Our team will review your documents and contact
          you once it has been approved.
        </p>
      </div>,
    )
  }

  const fe = (key) => fieldErrors[key]
  const invalid = (key) => Boolean(fieldErrors[key])
  const lastIndex = steps.length - 1

  return shell(
    <>
      <h1 className="h4 mb-1">Client registration{link?.label ? ` — ${link.label}` : ''}</h1>
      <p className="text-body-secondary mb-3">
        Step {stepIndex + 1} of {steps.length}: {step.title}
      </p>
      <CProgress className="mb-4" height={6} value={((stepIndex + 1) / steps.length) * 100} />

      {formError && (
        <CAlert color="danger" dismissible onClose={() => setFormError('')}>
          {formError}
        </CAlert>
      )}

      {step.id === 'personal' && (
        <CRow className="g-3">
          <Field label="First name *" error={fe('firstName')}>
            <CFormInput value={form.firstName} onChange={setField('firstName')} invalid={invalid('firstName')} autoComplete="given-name" />
          </Field>
          <Field label="Last name *" error={fe('lastName')}>
            <CFormInput value={form.lastName} onChange={setField('lastName')} invalid={invalid('lastName')} autoComplete="family-name" />
          </Field>
          <Field label="Date of birth *" error={fe('dateOfBirth')}>
            <CFormInput type="date" max={adultCutoff()} value={form.dateOfBirth} onChange={setField('dateOfBirth')} invalid={invalid('dateOfBirth')} />
          </Field>
          <Field label="Gender *" error={fe('gender')}>
            <CFormSelect value={form.gender} onChange={setField('gender')}>
              {GENDERS.map((g) => (
                <option key={g} value={g}>{titleCase(g)}</option>
              ))}
            </CFormSelect>
          </Field>
          <Field label="Email" error={fe('email')}>
            <CFormInput type="email" value={form.email} onChange={setField('email')} invalid={invalid('email')} autoComplete="email" />
          </Field>
          <Field label="Phone *" error={fe('phone')}>
            <CFormInput value={form.phone} onChange={setField('phone')} invalid={invalid('phone')} placeholder="0712 345 678" autoComplete="tel" />
          </Field>
          <Field label="Secondary phone" error={fe('secondaryPhone')}>
            <CFormInput value={form.secondaryPhone} onChange={setField('secondaryPhone')} invalid={invalid('secondaryPhone')} />
          </Field>
        </CRow>
      )}

      {step.id === 'address' && (
        <CRow className="g-3">
          <Field label="Street / estate *" error={fe('street')}>
            <CFormInput value={form.street} onChange={setField('street')} invalid={invalid('street')} autoComplete="address-line1" />
          </Field>
          <Field label="City / town *" error={fe('city')}>
            <CFormInput value={form.city} onChange={setField('city')} invalid={invalid('city')} autoComplete="address-level2" />
          </Field>
          <Field label="State / county" md={4} error={fe('state')}>
            <CFormInput value={form.state} onChange={setField('state')} />
          </Field>
          <Field label="Postal code" md={4} error={fe('postalCode')}>
            <CFormInput value={form.postalCode} onChange={setField('postalCode')} />
          </Field>
          <Field label="Country *" md={4} error={fe('country')}>
            <CFormSelect value={form.country} onChange={setField('country')}>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </CFormSelect>
          </Field>
          <Field label="Occupation *" md={4} error={fe('occupation')}>
            <CFormInput value={form.occupation} onChange={setField('occupation')} invalid={invalid('occupation')} />
          </Field>
          <Field label="Employer" md={4} error={fe('employer')}>
            <CFormInput value={form.employer} onChange={setField('employer')} />
          </Field>
          <Field label="Monthly income *" md={4} error={fe('monthlyIncome')}>
            <CFormInput type="number" min="0" step="0.01" value={form.monthlyIncome} onChange={setField('monthlyIncome')} invalid={invalid('monthlyIncome')} />
          </Field>
          <Field label="Preferred contact" error={fe('preferredContactMethod')}>
            <CFormSelect value={form.preferredContactMethod} onChange={setField('preferredContactMethod')}>
              <option value="">No preference</option>
              {CONTACT_METHODS.map((m) => (
                <option key={m} value={m}>{titleCase(m)}</option>
              ))}
            </CFormSelect>
          </Field>
        </CRow>
      )}

      {step.id === 'documents' && (
        <CRow className="g-3">
          <Field label="ID document type *" error={fe('idDocumentType')}>
            <CFormSelect value={form.idDocumentType} onChange={setField('idDocumentType')}>
              {ID_DOC_TYPES.map((t) => (
                <option key={t} value={t}>{titleCase(t)}</option>
              ))}
            </CFormSelect>
          </Field>
          <Field label="ID number *" error={fe('idDocumentNumber')}>
            <CFormInput value={form.idDocumentNumber} onChange={setField('idDocumentNumber')} invalid={invalid('idDocumentNumber')} />
          </Field>
          <CCol xs={12}>
            <hr className="mb-0" />
            <span className="text-body-secondary small">
              KYC documents: a photo and your ID document are required. JPG, PNG, WebP or PDF, up to 5 MB
              each; files are checked before they are accepted.
            </span>
          </CCol>
          <Field label="Document type" md={5}>
            <CFormSelect value={docType} onChange={(e) => setDocType(e.target.value)}>
              {CLIENT_KYC_DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {docLabel(t)}
                  {requiredDocTypes(form.idDocumentType).includes(t) ? ' *' : ''}
                </option>
              ))}
            </CFormSelect>
          </Field>
          <Field label="File" md={7}>
            <CFormInput
              key={docInputKey}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              onChange={(e) => {
                setPendingFile(e.target.files?.[0] || null)
                setDocError('')
              }}
            />
          </Field>
          <CCol xs={12}>
            <CButton type="button" color="primary" variant="outline" onClick={addDocument}>
              <CIcon icon={cilCloudUpload} className="me-1" />
              Add document
            </CButton>
            {docError && <div className="text-danger small mt-2">{docError}</div>}
          </CCol>
          <CCol xs={12}>
            {Object.keys(files).length === 0 ? (
              <p className="text-body-secondary mb-0">No documents added yet.</p>
            ) : (
              <div className="vstack gap-2">
                {Object.entries(files).map(([type, file]) => (
                  <div key={type} className="d-flex align-items-center justify-content-between border rounded p-2">
                    <div className="d-flex align-items-center gap-2 overflow-hidden">
                      <DocPreview file={file} />
                      <div className="overflow-hidden">
                        <StatusBadge enumDef={DOCUMENT_TYPE} value={type} />
                        <div className="small text-truncate text-body-secondary mt-1" title={file.name}>
                          {file.name}
                          <span className="ms-2">{formatSize(file.size)}</span>
                        </div>
                      </div>
                    </div>
                    <CButton
                      type="button"
                      size="sm"
                      color="danger"
                      variant="ghost"
                      title="Remove"
                      onClick={() => removeDocument(type)}
                    >
                      <CIcon icon={cilTrash} />
                    </CButton>
                  </div>
                ))}
              </div>
            )}
            {Object.entries(fieldErrors)
              .filter(([k]) => k.startsWith('files.'))
              .map(([k, message]) => (
                <div key={k} className="text-danger small mt-2">{message}</div>
              ))}
          </CCol>
        </CRow>
      )}

      {step.id === 'verify' && (
        <div>
          {phoneVerified ? (
            <CAlert color="success" className="mb-0">
              {form.phone} is verified. Continue to review your application.
            </CAlert>
          ) : (
            <>
              <p>
                We need to confirm {form.phone || 'your phone number'}. We will send a one-time code
                by SMS to that number.
              </p>
              <CRow className="g-3 align-items-end">
                <CCol md={4}>
                  <CButton color="primary" variant="outline" onClick={requestOtp} disabled={otpBusy || cooldown > 0}>
                    {otpBusy && !otpSent && <CSpinner size="sm" className="me-2" />}
                    {otpSent ? (cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code') : 'Send code'}
                  </CButton>
                </CCol>
              </CRow>
              {otpSent && (
                <CRow className="g-3 align-items-end mt-1">
                  <Field label="Verification code" md={4}>
                    <CFormInput value={otpCode} onChange={(e) => setOtpCode(e.target.value)} inputMode="numeric" maxLength={10} />
                  </Field>
                  <CCol md={4}>
                    <CButton color="primary" onClick={verifyOtp} disabled={otpBusy || otpCode.trim().length < 4}>
                      {otpBusy && <CSpinner size="sm" className="me-2" />}
                      Verify
                    </CButton>
                  </CCol>
                </CRow>
              )}
              {otpError && <CAlert color="danger" className="mt-3 mb-0">{otpError}</CAlert>}
              {fe('phoneVerification') && (
                <div className="text-danger small mt-3">{fe('phoneVerification')}</div>
              )}
            </>
          )}
        </div>
      )}

      {step.id === 'review' && (
        <div>
          <p className="text-body-secondary">Check your details, then submit your application.</p>
          <dl className="row mb-3">
            {[
              ['Name', `${form.firstName} ${form.lastName}`],
              ['Date of birth', form.dateOfBirth],
              ['Email', form.email],
              ['Phone', `${form.phone}${link?.otpRequired ? ' (verified)' : ''}`],
              ['Address', [form.street, form.city, form.state, form.country].filter(Boolean).join(', ')],
              ['Occupation', form.occupation],
              ['Monthly income', form.monthlyIncome],
              ['ID', `${titleCase(form.idDocumentType)} — ${form.idDocumentNumber}`],
              ...Object.entries(files).map(([type, file]) => [docLabel(type), file.name]),
            ].map(([k, v]) => (
              <React.Fragment key={k}>
                <dt className="col-sm-4">{k}</dt>
                <dd className="col-sm-8">{v || '—'}</dd>
              </React.Fragment>
            ))}
          </dl>
          {Object.keys(fieldErrors).length > 0 && (
            <CAlert color="warning">Some details need attention. Go back to the highlighted step.</CAlert>
          )}
        </div>
      )}

      <div className="d-flex justify-content-between mt-4">
        <CButton color="secondary" variant="outline" onClick={goBack} disabled={stepIndex === 0 || submitting}>
          Back
        </CButton>
        {stepIndex < lastIndex ? (
          <CButton color="primary" onClick={goNext} disabled={step.id === 'verify' && !phoneVerified}>
            Next
          </CButton>
        ) : (
          <CButton color="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting && <CSpinner size="sm" className="me-2" />}
            Submit application
          </CButton>
        )}
      </div>
    </>,
  )
}

export default ClientRegistration
