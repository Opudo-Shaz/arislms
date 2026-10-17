/**
 * RegistrationLinkCreateModal
 *
 * Generates an invite-only client registration link. Recipients (emails
 * and/or phone numbers) are optional: with none, the link is only generated
 * and can be copied and shared separately. Recipients are used once to queue
 * the messages and are not stored.
 *
 * @module views/clients/RegistrationLinkCreateModal
 */

import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CInputGroup,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'

import { useCreateRegistrationLink } from '../../hooks/useClientRegistrationLinks'

const parseRecipients = (text) =>
  [...new Set(text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))]

const RegistrationLinkCreateModal = ({ visible, onClose }) => {
  const createMutation = useCreateRegistrationLink()

  const [label, setLabel] = useState('')
  const [recipientsText, setRecipientsText] = useState('')
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (visible) {
      setLabel('')
      setRecipientsText('')
      setError(null)
      setResult(null)
      setCopied(false)
    }
  }, [visible])

  const recipients = parseRecipients(recipientsText)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      setResult(
        await createMutation.mutateAsync({
          label: label.trim() || undefined,
          recipients,
        }),
      )
    } catch (err) {
      setError(err)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(result.url)
      setCopied(true)
    } catch {
      // Clipboard unavailable; the URL is selectable in the field.
    }
  }

  return (
    <CModal visible={visible} onClose={onClose} alignment="center" size="lg">
      {result ? (
        <>
          <CModalHeader>
            <CModalTitle>Registration link ready</CModalTitle>
          </CModalHeader>
          <CModalBody>
            {result.sent && result.sent.email + result.sent.sms > 0 && (
              <CAlert color="success">
                Queued for {result.sent.email} email(s) and {result.sent.sms} SMS recipient(s).
              </CAlert>
            )}
            {result.warnings.map((w) => (
              <CAlert key={w} color="warning">
                {w}
              </CAlert>
            ))}
            <CFormLabel>Link</CFormLabel>
            <CInputGroup className="mb-2">
              <CFormInput readOnly value={result.url} onFocus={(e) => e.target.select()} />
              <CButton color="secondary" variant="outline" onClick={copyLink}>
                {copied ? 'Copied!' : 'Copy'}
              </CButton>
            </CInputGroup>
            <div className="text-body-secondary small">
              Anyone with this link can register until it expires or is revoked. You can copy it
              again later from the links list.
            </div>
          </CModalBody>
          <CModalFooter>
            <CButton color="primary" onClick={onClose}>
              Done
            </CButton>
          </CModalFooter>
        </>
      ) : (
        <CForm onSubmit={handleSubmit}>
          <CModalHeader>
            <CModalTitle>New registration link</CModalTitle>
          </CModalHeader>
          <CModalBody>
            {error && (
              <CAlert color="danger" dismissible onClose={() => setError(null)}>
                <div>{error.message || 'Failed to create the link.'}</div>
                {Array.isArray(error.data?.errors) && (
                  <ul className="mb-0 mt-2">
                    {error.data.errors.map((m, i) => (
                      <li key={i}>{typeof m === 'string' ? m : m.message}</li>
                    ))}
                  </ul>
                )}
              </CAlert>
            )}

            <div className="mb-3">
              <CFormLabel>Label</CFormLabel>
              <CFormInput
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={150}
                placeholder="e.g. Nairobi branch drive"
              />
            </div>

            <div className="mb-2">
              <CFormLabel>Send to (optional)</CFormLabel>
              <CFormTextarea
                rows={4}
                value={recipientsText}
                onChange={(e) => setRecipientsText(e.target.value)}
                placeholder={'jane@example.com\n0712345678'}
              />
            </div>
            <div className="text-body-secondary small">
              Email addresses and phone numbers, separated by commas or new lines.
              {recipients.length > 0 && ` ${recipients.length} recipient(s).`} Leave empty to only
              generate the link. The link is valid for 10 days.
            </div>
          </CModalBody>
          <CModalFooter>
            <CButton type="button" color="secondary" variant="outline" onClick={onClose}>
              Cancel
            </CButton>
            <CButton type="submit" color="primary" disabled={createMutation.isPending}>
              {createMutation.isPending && <CSpinner size="sm" className="me-2" />}
              {recipients.length ? 'Generate and send' : 'Generate link'}
            </CButton>
          </CModalFooter>
        </CForm>
      )}
    </CModal>
  )
}

RegistrationLinkCreateModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
}

export default RegistrationLinkCreateModal
