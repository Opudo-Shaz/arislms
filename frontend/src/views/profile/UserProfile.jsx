/**
 * UserProfile
 *
 * Logged-in user's own profile and settings page.
 * - Profile tab: view / edit personal info + upload/update profile photo.
 * - Settings tab: language, date format and other display preferences
 *   (persisted in localStorage).
 *
 * @module views/profile/UserProfile
 */

import React, { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CAlert,
  CAvatar,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CSpinner,
  CTabContent,
  CTabPane,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCamera, cilLockLocked, cilPencil, cilSave, cilX } from '@coreui/icons'
import { Eye, EyeOff } from 'lucide-react'

import { useAuth } from '../../context/AuthContext'
import { useUser, useUpdateMe, useChangePassword } from '../../hooks/useUsers'
import { useUserDocuments, useDocumentBlobUrl, useUploadUserDocument } from '../../hooks/useDocuments'
import { ROLE_LABELS, USER_PHOTO_DOCUMENT_TYPE, USER_KYC_CATEGORY } from '../../constants/enums'
import { formatDate } from '../../utils/format'

// ─── Settings persistence ──────────────────────────────────────────────────
const SETTINGS_KEY = 'aris_user_settings'

const DEFAULT_SETTINGS = {
  language: 'en',
  dateFormat: 'DD/MM/YYYY',
  timezone: 'Africa/Nairobi',
}

const loadSettings = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

const saveSettings = (settings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

// ─── Sub-components ────────────────────────────────────────────────────────
const Field = ({ label, children }) => (
  <CCol md={6} className="mb-3">
    <div className="text-body-secondary small mb-1">{label}</div>
    <div>{children ?? '—'}</div>
  </CCol>
)

/** Avatar that loads a blob URL for an auth-protected photo. */
const ProfilePhoto = ({ photoDocId, size = 96 }) => {
  const blobUrl = useDocumentBlobUrl(photoDocId)
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        background: 'var(--cui-secondary-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {blobUrl ? (
        <img
          src={blobUrl}
          alt="Profile"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span style={{ fontSize: size * 0.45, lineHeight: 1, color: 'var(--cui-secondary-color)' }}>
          👤
        </span>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────
const UserProfile = () => {
  const { user: authUser } = useAuth()
  const userId = authUser?.id
  const [searchParams] = useSearchParams()

  const { data: profile, isLoading, error } = useUser(userId)
  const { data: userDocs = [] } = useUserDocuments(userId)
  const updateMe = useUpdateMe()
  const uploadDoc = useUploadUserDocument(userId)
  const changePwd = useChangePassword()

  const fileInputRef = useRef(null)
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'settings' ? 1 : searchParams.get('tab') === 'security' ? 2 : 0)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ first_name: '', middle_name: '', last_name: '', phone: '' })
  const [formError, setFormError] = useState(null)
  const [formSuccess, setFormSuccess] = useState(null)
  const [photoError, setPhotoError] = useState(null)
  const [settings, setSettings] = useState(loadSettings)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwdError, setPwdError] = useState(null)  // { message, errors[] } or null
  const [pwdSuccess, setPwdSuccess] = useState(null)
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false })

  // Latest user_photo document
  const photoDoc = userDocs
    .filter((d) => d.documentType === USER_PHOTO_DOCUMENT_TYPE || d.document_type === USER_PHOTO_DOCUMENT_TYPE)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setForm({
        first_name: profile.first_name ?? '',
        middle_name: profile.middle_name ?? '',
        last_name: profile.last_name ?? '',
        phone: profile.phone ?? '',
      })
    }
  }, [profile])

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(null)
    try {
      await updateMe.mutateAsync({ id: userId, payload: form })
      setFormSuccess('Profile updated successfully.')
      setEditing(false)
    } catch (err) {
      setFormError(err?.data?.error || err?.data?.message || err?.message || 'Update failed.')
    }
  }

  const handleCancelEdit = () => {
    setEditing(false)
    setFormError(null)
    if (profile) {
      setForm({
        first_name: profile.first_name ?? '',
        middle_name: profile.middle_name ?? '',
        last_name: profile.last_name ?? '',
        phone: profile.phone ?? '',
      })
    }
  }

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('documentType', USER_PHOTO_DOCUMENT_TYPE)
    fd.append('documentCategory', USER_KYC_CATEGORY)
    fd.append('userId', String(userId))
    fd.append('description', 'Profile photo')
    try {
      await uploadDoc.mutateAsync(fd)
    } catch (err) {
      setPhotoError(err?.data?.message || err?.message || 'Photo upload failed.')
    }
    // Reset input so the same file can be re-selected if needed
    e.target.value = ''
  }

  const handleSettingChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSettingsSaved(false)
  }

  const handleSaveSettings = () => {
    saveSettings(settings)
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2500)
  }

  const handlePwdChange = (e) => {
    const { name, value } = e.target
    setPwdForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPwdError(null)
    setPwdSuccess(null)
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdError('New passwords do not match.')
      return
    }
    try {
      await changePwd.mutateAsync({
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      })
      setPwdSuccess('Password changed successfully.')
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      setPwdError({
        message: err?.data?.message || err?.message || 'Failed to change password.',
        errors: Array.isArray(err?.data?.errors) ? err.data.errors : [],
      })
    }
  }

  const fullName = profile
    ? [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ').trim()
    : authUser?.name || authUser?.email || '—'

  const roleName = ROLE_LABELS[profile?.role] ?? ROLE_LABELS[authUser?.role] ?? `Role ${authUser?.role ?? '?'}`

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: 200 }}>
        <CSpinner />
      </div>
    )
  }

  if (error) {
    return <CAlert color="danger">Failed to load profile: {error.message}</CAlert>
  }

  return (
    <CRow className="justify-content-center">
      <CCol lg={9} xl={8}>
        {/* ── Header card ── */}
        <CCard className="mb-4">
          <CCardBody>
            <div className="d-flex align-items-center gap-4 flex-wrap">
              {/* Photo */}
              <div className="position-relative" style={{ flexShrink: 0 }}>
                <ProfilePhoto photoDocId={photoDoc?.id} size={96} />
                <CButton
                  color="primary"
                  variant="ghost"
                  size="sm"
                  className="position-absolute bottom-0 end-0 p-1 rounded-circle"
                  style={{ background: 'var(--cui-body-bg)', border: '1px solid var(--cui-border-color)' }}
                  title="Change photo"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadDoc.isPending}
                >
                  {uploadDoc.isPending ? (
                    <CSpinner size="sm" />
                  ) : (
                    <CIcon icon={cilCamera} size="sm" />
                  )}
                </CButton>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={handlePhotoChange}
                />
              </div>

              {/* Name + role */}
              <div>
                <h4 className="mb-1">{fullName}</h4>
                <CBadge color="info" className="me-2">{roleName}</CBadge>
                <span className="text-body-secondary small">{profile?.email ?? authUser?.email}</span>
              </div>
            </div>

            {photoError && (
              <CAlert color="danger" className="mt-3 mb-0 py-2">
                {photoError}
              </CAlert>
            )}
          </CCardBody>
        </CCard>

        {/* ── Tabs ── */}
        <CCard>
          <CCardBody>
            <CNav variant="tabs" className="mb-3">
              <CNavItem>
                <CNavLink active={activeTab === 0} role="button" onClick={() => setActiveTab(0)}>
                  Profile
                </CNavLink>
              </CNavItem>
              <CNavItem>
                <CNavLink active={activeTab === 1} role="button" onClick={() => setActiveTab(1)}>
                  Settings
                </CNavLink>
              </CNavItem>
              <CNavItem>
                <CNavLink active={activeTab === 2} role="button" onClick={() => setActiveTab(2)}>
                  Security
                </CNavLink>
              </CNavItem>
            </CNav>

            <CTabContent>
              {/* ─── Profile tab ─── */}
              <CTabPane visible={activeTab === 0}>
                {formError && <CAlert color="danger">{formError}</CAlert>}
                {formSuccess && <CAlert color="success">{formSuccess}</CAlert>}

                {editing ? (
                  <CForm onSubmit={handleSaveProfile}>
                    <CRow>
                      <CCol md={6} className="mb-3">
                        <CFormLabel>First Name</CFormLabel>
                        <CFormInput
                          name="first_name"
                          value={form.first_name}
                          onChange={handleFormChange}
                          required
                        />
                      </CCol>
                      <CCol md={6} className="mb-3">
                        <CFormLabel>Middle Name</CFormLabel>
                        <CFormInput
                          name="middle_name"
                          value={form.middle_name}
                          onChange={handleFormChange}
                        />
                      </CCol>
                      <CCol md={6} className="mb-3">
                        <CFormLabel>Last Name</CFormLabel>
                        <CFormInput
                          name="last_name"
                          value={form.last_name}
                          onChange={handleFormChange}
                          required
                        />
                      </CCol>
                      <CCol md={6} className="mb-3">
                        <CFormLabel>Phone</CFormLabel>
                        <CFormInput
                          name="phone"
                          value={form.phone}
                          onChange={handleFormChange}
                          placeholder="+2547xxxxxxxx"
                        />
                      </CCol>
                    </CRow>
                    <div className="d-flex gap-2">
                      <CButton
                        type="submit"
                        color="primary"
                        size="sm"
                        disabled={updateMe.isPending}
                      >
                        {updateMe.isPending ? <CSpinner size="sm" className="me-1" /> : <CIcon icon={cilSave} className="me-1" />}
                        Save Changes
                      </CButton>
                      <CButton
                        type="button"
                        color="secondary"
                        variant="outline"
                        size="sm"
                        onClick={handleCancelEdit}
                      >
                        <CIcon icon={cilX} className="me-1" />
                        Cancel
                      </CButton>
                    </div>
                  </CForm>
                ) : (
                  <>
                    <CRow>
                      <Field label="First Name">{profile?.first_name}</Field>
                      <Field label="Middle Name">{profile?.middle_name || '—'}</Field>
                      <Field label="Last Name">{profile?.last_name}</Field>
                      <Field label="Email">{profile?.email ?? authUser?.email}</Field>
                      <Field label="Phone">{profile?.phone}</Field>
                      <Field label="ID Number">{profile?.id_number}</Field>
                      <Field label="Role">{roleName}</Field>
                      <Field label="Member Since">{formatDate(profile?.created_at)}</Field>
                    </CRow>
                    <CButton
                      color="primary"
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditing(true); setFormSuccess(null) }}
                    >
                      <CIcon icon={cilPencil} className="me-1" />
                      Edit Profile
                    </CButton>
                  </>
                )}
              </CTabPane>

              {/* ─── Settings tab ─── */}
              <CTabPane visible={activeTab === 1}>
                {settingsSaved && (
                  <CAlert color="success" className="py-2">
                    Settings saved.
                  </CAlert>
                )}
                <CRow>
                  <CCol md={6} className="mb-3">
                    <CFormLabel>Language</CFormLabel>
                    <CFormSelect
                      value={settings.language}
                      onChange={(e) => handleSettingChange('language', e.target.value)}
                    >
                      <option value="en">English</option>
                      <option value="fr">French</option>
                      <option value="sw">Swahili</option>
                    </CFormSelect>
                  </CCol>
                  <CCol md={6} className="mb-3">
                    <CFormLabel>Date Format</CFormLabel>
                    <CFormSelect
                      value={settings.dateFormat}
                      onChange={(e) => handleSettingChange('dateFormat', e.target.value)}
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                      <option value="D MMM YYYY">D MMM YYYY</option>
                    </CFormSelect>
                  </CCol>
                  <CCol md={6} className="mb-3">
                    <CFormLabel>Timezone</CFormLabel>
                    <CFormSelect
                      value={settings.timezone}
                      onChange={(e) => handleSettingChange('timezone', e.target.value)}
                    >
                      <option value="Africa/Nairobi">Africa/Nairobi (EAT +3)</option>
                      <option value="UTC">UTC</option>
                      <option value="Europe/London">Europe/London</option>
                      <option value="America/New_York">America/New_York</option>
                    </CFormSelect>
                  </CCol>
                </CRow>
                <CButton color="primary" size="sm" onClick={handleSaveSettings}>
                  <CIcon icon={cilSave} className="me-1" />
                  Save Settings
                </CButton>
              </CTabPane>

              {/* ─── Security tab ─── */}
              <CTabPane visible={activeTab === 2}>
                <p className="text-body-secondary small mb-3">
                  Choose a strong password with at least 8 characters, including a letter, a number,
                  and a special character.
                </p>
                {pwdError && (
                  <CAlert color="danger">
                    <div>{pwdError.message}</div>
                    {pwdError.errors.length > 0 && (
                      <ul className="mb-0 mt-2">
                        {pwdError.errors.map((e, i) => (
                          <li key={i}>{typeof e === 'string' ? e : e.message}</li>
                        ))}
                      </ul>
                    )}
                  </CAlert>
                )}
                {pwdSuccess && <CAlert color="success">{pwdSuccess}</CAlert>}
                <CForm onSubmit={handleChangePassword}>
                  <CRow>
                    <CCol md={6} className="mb-3">
                      <CFormLabel>Current Password</CFormLabel>
                      <CInputGroup>
                        <CFormInput
                          type={showPwd.current ? 'text' : 'password'}
                          name="currentPassword"
                          value={pwdForm.currentPassword}
                          onChange={handlePwdChange}
                          autoComplete="current-password"
                          required
                        />
                        <CInputGroupText
                          role="button"
                          title={showPwd.current ? 'Hide' : 'Show'}
                          onClick={() => setShowPwd((s) => ({ ...s, current: !s.current }))}
                          style={{ cursor: 'pointer' }}
                        >
                          {showPwd.current ? <Eye size={16} /> : <EyeOff size={16} />}
                        </CInputGroupText>
                      </CInputGroup>
                    </CCol>
                  </CRow>
                  <CRow>
                    <CCol md={6} className="mb-3">
                      <CFormLabel>New Password</CFormLabel>
                      <CInputGroup>
                        <CFormInput
                          type={showPwd.next ? 'text' : 'password'}
                          name="newPassword"
                          value={pwdForm.newPassword}
                          onChange={handlePwdChange}
                          autoComplete="new-password"
                          required
                        />
                        <CInputGroupText
                          role="button"
                          title={showPwd.next ? 'Hide' : 'Show'}
                          onClick={() => setShowPwd((s) => ({ ...s, next: !s.next }))}
                          style={{ cursor: 'pointer' }}
                        >
                          {showPwd.next ? <Eye size={16} /> : <EyeOff size={16} />}
                        </CInputGroupText>
                      </CInputGroup>
                    </CCol>
                    <CCol md={6} className="mb-3">
                      <CFormLabel>Confirm New Password</CFormLabel>
                      <CInputGroup>
                        <CFormInput
                          type={showPwd.confirm ? 'text' : 'password'}
                          name="confirmPassword"
                          value={pwdForm.confirmPassword}
                          onChange={handlePwdChange}
                          autoComplete="new-password"
                          required
                        />
                        <CInputGroupText
                          role="button"
                          title={showPwd.confirm ? 'Hide' : 'Show'}
                          onClick={() => setShowPwd((s) => ({ ...s, confirm: !s.confirm }))}
                          style={{ cursor: 'pointer' }}
                        >
                          {showPwd.confirm ? <Eye size={16} /> : <EyeOff size={16} />}
                        </CInputGroupText>
                      </CInputGroup>
                    </CCol>
                  </CRow>
                  <CButton type="submit" color="primary" size="sm" disabled={changePwd.isPending}>
                    {changePwd.isPending ? <CSpinner size="sm" className="me-1" /> : <CIcon icon={cilLockLocked} className="me-1" />}
                    Change Password
                  </CButton>
                </CForm>
              </CTabPane>
            </CTabContent>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default UserProfile
