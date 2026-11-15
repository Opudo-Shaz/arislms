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
  CFormSwitch,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilBell, cilChatBubble, cilEnvelopeClosed, cilInbox, cilSpeech } from '@coreui/icons'

import {
  useCreateNotificationTemplate,
  useUpdateNotificationTemplate,
} from '../../hooks/useNotificationTemplates'
import { NOTIFICATION_EVENT_TYPE } from '../../constants/enums'

/** Visually distinct section for one channel: coloured divider, header band, and enabled switch. */
const ChannelSection = ({ title, icon, color, enabled, onToggle, children }) => (
  <CCol xs={12}>
    <div
      className="rounded overflow-hidden mt-2"
      style={{ border: `1px solid color-mix(in srgb, ${color} 33%, transparent)`, borderTop: `4px solid ${color}` }}
    >
      <div
        className="d-flex align-items-center justify-content-between px-3 py-2"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)` }}
      >
        <div className="d-flex align-items-center gap-2 fw-bold fs-5" style={{ color }}>
          <CIcon icon={icon} size="lg" />
          {title}
        </div>
        <CFormSwitch
          id={`channel-switch-${title}`}
          size="lg"
          label={enabled ? 'Enabled' : 'Disabled'}
          checked={enabled}
          onChange={onToggle}
          className={enabled ? 'fw-semibold text-success' : 'fw-semibold text-body-secondary'}
        />
      </div>
      <div className="p-3">
        <CRow className="g-3">{children}</CRow>
      </div>
    </div>
  </CCol>
)

ChannelSection.propTypes = {
  title: PropTypes.string.isRequired,
  icon: PropTypes.oneOfType([PropTypes.array, PropTypes.string, PropTypes.object]).isRequired,
  color: PropTypes.string.isRequired,
  enabled: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  children: PropTypes.node,
}

const emptyForm = {
  eventKey: '',
  description: '',
  emailEnabled: true,
  emailSubject: '',
  emailBody: '',
  smsEnabled: true,
  smsBody: '',
  whatsappEnabled: false,
  whatsappBody: '',
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
  whatsappEnabled: t.whatsappEnabled === true,
  whatsappBody: t.whatsappBody || '',
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
      whatsappEnabled: form.whatsappEnabled,
      whatsappBody: form.whatsappBody.trim() || null,
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
              <CFormLabel>Event Key <span className="text-danger">*</span></CFormLabel>
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
              <div className="d-flex align-items-center gap-2 py-2 px-1">
                <CFormCheck
                  id="template-active"
                  checked={form.isActive}
                  onChange={setCheck('isActive')}
                  style={{ width: '1.5em', height: '1.5em', margin: 0, borderRadius: '50%', borderWidth: 2, borderColor: 'var(--tpl-ch-email)', cursor: 'pointer' }}
                />
                <label htmlFor="template-active" className="fw-semibold mb-0" style={{ cursor: 'pointer' }}>
                  {form.isActive ? 'Active' : 'Inactive'}
                </label>
              </div>
            </CCol>

            <ChannelSection title="Email" icon={cilEnvelopeClosed} color="var(--tpl-ch-email)" enabled={form.emailEnabled} onToggle={setCheck('emailEnabled')}>
              <CCol xs={12}>
                <CFormLabel>Subject</CFormLabel>
                <CFormInput value={form.emailSubject} onChange={setField('emailSubject')} maxLength={255} />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Body</CFormLabel>
                <CFormTextarea rows={3} value={form.emailBody} onChange={setField('emailBody')} />
                <div className="form-text">Supports `{'{{variable}}'}` placeholders, e.g. `{'{{clientName}}'}`.</div>
              </CCol>
            </ChannelSection>

            <ChannelSection title="SMS" icon={cilChatBubble} color="var(--tpl-ch-sms)" enabled={form.smsEnabled} onToggle={setCheck('smsEnabled')}>
              <CCol xs={12}>
                <CFormLabel>Body</CFormLabel>
                <CFormTextarea rows={2} value={form.smsBody} onChange={setField('smsBody')} />
              </CCol>
            </ChannelSection>

            <ChannelSection title="WhatsApp" icon={cilSpeech} color="var(--tpl-ch-whatsapp)" enabled={form.whatsappEnabled} onToggle={setCheck('whatsappEnabled')}>
              <CCol xs={12}>
                <CFormLabel>Body</CFormLabel>
                <CFormTextarea rows={2} value={form.whatsappBody} onChange={setField('whatsappBody')} />
                <div className="form-text">Leave blank to send the SMS body. The channel must also be enabled in System Config.</div>
              </CCol>
            </ChannelSection>

            <ChannelSection title="Push" icon={cilBell} color="var(--tpl-ch-push)" enabled={form.pushEnabled} onToggle={setCheck('pushEnabled')}>
              <CCol xs={12}>
                <CFormLabel>Title</CFormLabel>
                <CFormInput value={form.pushTitle} onChange={setField('pushTitle')} maxLength={150} />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Body</CFormLabel>
                <CFormTextarea rows={2} value={form.pushBody} onChange={setField('pushBody')} />
              </CCol>
            </ChannelSection>

            <ChannelSection title="In-App" icon={cilInbox} color="var(--tpl-ch-inapp)" enabled={form.inAppEnabled} onToggle={setCheck('inAppEnabled')}>
              <CCol xs={12}>
                <CFormLabel>Title</CFormLabel>
                <CFormInput value={form.inAppTitle} onChange={setField('inAppTitle')} maxLength={150} />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Body</CFormLabel>
                <CFormTextarea rows={2} value={form.inAppBody} onChange={setField('inAppBody')} />
              </CCol>
            </ChannelSection>
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
