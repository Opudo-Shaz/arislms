/**
 * NotificationTemplateForm
 *
 * Modal create/edit form for a NotificationTemplate — one entry per event key,
 * with per-channel (email/SMS/push/in-app) enable toggle and content fields.
 * `eventKey` is immutable after creation. Body fields support `{{var}}`
 * placeholders resolved by the backend template renderer at dispatch time.
 *
 * @module views/admin/NotificationTemplateForm
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

import {
  useCreateNotificationTemplate,
  useUpdateNotificationTemplate,
} from '../../hooks/useNotificationTemplates'
import { NOTIFICATION_EVENT_TYPE } from '../../constants/enums'

const emptyForm = {
  eventKey: '',
  description: '',
  emailEnabled: true,
  emailSubject: '',
  emailBody: '',
  smsEnabled: true,
  smsBody: '',
  pushEnabled: true,
  pushTitle: '',
  pushBody: '',
  inAppEnabled: true,
  inAppTitle: '',
  inAppBody: '',
  isActive: true,
}

const toForm = (t) => ({
  eventKey: t.eventKey || '',
  description: t.description || '',
  emailEnabled: t.emailEnabled !== false,
  emailSubject: t.emailSubject || '',
  emailBody: t.emailBody || '',
  smsEnabled: t.smsEnabled !== false,
  smsBody: t.smsBody || '',
  pushEnabled: t.pushEnabled !== false,
  pushTitle: t.pushTitle || '',
  pushBody: t.pushBody || '',
  inAppEnabled: t.inAppEnabled !== false,
  inAppTitle: t.inAppTitle || '',
  inAppBody: t.inAppBody || '',
  isActive: t.isActive !== false,
})

const NotificationTemplateForm = ({ visible, template, onClose }) => {
  const isEdit = Boolean(template)
  const createMutation = useCreateNotificationTemplate()
  const updateMutation = useUpdateNotificationTemplate()
  const saving = createMutation.isPending || updateMutation.isPending

  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (visible) {
      setForm(template ? toForm(template) : emptyForm)
      setError(null)
    }
  }, [visible, template])

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const setCheck = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.checked }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    const payload = {
      description: form.description.trim() || null,
      emailEnabled: form.emailEnabled,
      emailSubject: form.emailSubject.trim() || null,
      emailBody: form.emailBody.trim() || null,
      smsEnabled: form.smsEnabled,
      smsBody: form.smsBody.trim() || null,
      pushEnabled: form.pushEnabled,
      pushTitle: form.pushTitle.trim() || null,
      pushBody: form.pushBody.trim() || null,
      inAppEnabled: form.inAppEnabled,
      inAppTitle: form.inAppTitle.trim() || null,
      inAppBody: form.inAppBody.trim() || null,
      isActive: form.isActive,
    }
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: template.id, payload })
      } else {
        await createMutation.mutateAsync({ ...payload, eventKey: form.eventKey.trim().toLowerCase() })
      }
      onClose()
    } catch (err) {
      setError(err)
    }
  }

  return (
    <CModal visible={visible} onClose={onClose} alignment="center" size="lg" scrollable>
      <CModalHeader>
        <CModalTitle>{isEdit ? 'Edit Notification Template' : 'New Notification Template'}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <CForm id="notification-template-form" onSubmit={handleSubmit}>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError(null)}>
              <div>{error.message || 'Failed to save notification template.'}</div>
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
              <CFormLabel>Event Key *</CFormLabel>
              <CFormInput
                value={form.eventKey}
                onChange={setField('eventKey')}
                placeholder="e.g. loan_approved"
                maxLength={64}
                disabled={isEdit}
                list="notification-event-key-suggestions"
                required
              />
              <datalist id="notification-event-key-suggestions">
                {NOTIFICATION_EVENT_TYPE.values.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              <div className="form-text">
                Lowercase letters, numbers and underscores only. Matches the event key raised by the
                backend trigger. Cannot be changed later.
              </div>
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Description</CFormLabel>
              <CFormTextarea rows={2} value={form.description} onChange={setField('description')} maxLength={500} />
            </CCol>
            <CCol xs={12}>
              <CFormCheck label="Active" checked={form.isActive} onChange={setCheck('isActive')} />
            </CCol>

            {/* Email */}
            <CCol xs={12}>
              <hr className="my-2" />
              <div className="d-flex align-items-center justify-content-between">
                <CFormLabel className="mb-0 fw-semibold">Email</CFormLabel>
                <CFormCheck label="Enabled" checked={form.emailEnabled} onChange={setCheck('emailEnabled')} />
              </div>
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Subject</CFormLabel>
              <CFormInput value={form.emailSubject} onChange={setField('emailSubject')} maxLength={255} />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Body</CFormLabel>
              <CFormTextarea rows={3} value={form.emailBody} onChange={setField('emailBody')} />
              <div className="form-text">Supports `{'{{variable}}'}` placeholders, e.g. `{'{{clientName}}'}`.</div>
            </CCol>

            {/* SMS */}
            <CCol xs={12}>
              <hr className="my-2" />
              <div className="d-flex align-items-center justify-content-between">
                <CFormLabel className="mb-0 fw-semibold">SMS</CFormLabel>
                <CFormCheck label="Enabled" checked={form.smsEnabled} onChange={setCheck('smsEnabled')} />
              </div>
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Body</CFormLabel>
              <CFormTextarea rows={2} value={form.smsBody} onChange={setField('smsBody')} />
            </CCol>

            {/* Push */}
            <CCol xs={12}>
              <hr className="my-2" />
              <div className="d-flex align-items-center justify-content-between">
                <CFormLabel className="mb-0 fw-semibold">Push</CFormLabel>
                <CFormCheck label="Enabled" checked={form.pushEnabled} onChange={setCheck('pushEnabled')} />
              </div>
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Title</CFormLabel>
              <CFormInput value={form.pushTitle} onChange={setField('pushTitle')} maxLength={150} />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Body</CFormLabel>
              <CFormTextarea rows={2} value={form.pushBody} onChange={setField('pushBody')} />
            </CCol>

            {/* In-App */}
            <CCol xs={12}>
              <hr className="my-2" />
              <div className="d-flex align-items-center justify-content-between">
                <CFormLabel className="mb-0 fw-semibold">In-App</CFormLabel>
                <CFormCheck label="Enabled" checked={form.inAppEnabled} onChange={setCheck('inAppEnabled')} />
              </div>
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Title</CFormLabel>
              <CFormInput value={form.inAppTitle} onChange={setField('inAppTitle')} maxLength={150} />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Body</CFormLabel>
              <CFormTextarea rows={2} value={form.inAppBody} onChange={setField('inAppBody')} />
            </CCol>
          </CRow>
        </CForm>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </CButton>
        <CButton color="primary" type="submit" form="notification-template-form" disabled={saving}>
          {saving && <CSpinner size="sm" className="me-2" />}
          {isEdit ? 'Save Changes' : 'Create Template'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

NotificationTemplateForm.propTypes = {
  visible: PropTypes.bool.isRequired,
  template: PropTypes.object,
  onClose: PropTypes.func.isRequired,
}

export default NotificationTemplateForm
