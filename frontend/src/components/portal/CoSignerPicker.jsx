/**
 * Client portal: pick a co-signer by their exact phone number.
 *
 * There is deliberately no search/browse — the borrower must already know the
 * co-signer's number. A match shows only a masked name and phone so the
 * borrower can confirm it's the right person; the selection is a short-lived
 * signed token (`coSignerToken`), never a client id.
 *
 * @component
 */

import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CFormInput,
  CFormLabel,
  CInputGroup,
  CInputGroupText,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCheckCircle, cilPhone } from '@coreui/icons'
import portalApi from '../../api/portalApi'

const CoSignerPicker = ({ value, onChange, id = 'co-signer-phone', disabled = false }) => {
  const [phone, setPhone] = useState('')
  const [looking, setLooking] = useState(false)
  const [error, setError] = useState('')

  const lookup = async () => {
    setError('')
    setLooking(true)
    try {
      const match = await portalApi.lookupCoSigner(phone.trim())
      onChange(match)
    } catch (err) {
      setError(err?.data?.errors?.[0]?.message || err?.message || 'Could not look up that number.')
    } finally {
      setLooking(false)
    }
  }

  if (value) {
    return (
      <div className="border rounded p-3 d-flex flex-wrap align-items-center gap-2">
        <CIcon icon={cilCheckCircle} className="text-success" />
        <div>
          <div className="fw-semibold">{value.displayName}</div>
          <div className="small text-body-secondary">{value.maskedPhone}</div>
        </div>
        <CButton
          color="secondary"
          variant="ghost"
          size="sm"
          className="ms-auto"
          disabled={disabled}
          onClick={() => {
            onChange(null)
            setPhone('')
          }}
        >
          Change
        </CButton>
        <div className="w-100 small text-body-secondary">
          Is this the right person? They&apos;ll get a link by SMS/email to review and consent before your loan can be approved.
        </div>
      </div>
    )
  }

  return (
    <div>
      <CFormLabel htmlFor={id}>Co-signer&apos;s phone number</CFormLabel>
      <CInputGroup>
        <CInputGroupText>
          <CIcon icon={cilPhone} />
        </CInputGroupText>
        <CFormInput
          id={id}
          type="tel"
          inputMode="tel"
          placeholder="e.g. 0712 345 678"
          value={phone}
          disabled={disabled || looking}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (phone.trim()) lookup()
            }
          }}
        />
        <CButton type="button" color="secondary" variant="outline" disabled={disabled || looking || !phone.trim()} onClick={lookup}>
          {looking ? <CSpinner size="sm" /> : 'Find'}
        </CButton>
      </CInputGroup>
      <div className="form-text">
        Your co-signer must be a registered client with verified identity. Enter the phone number they registered with.
      </div>
      {error ? <CAlert color="warning" className="py-2 mt-2 mb-0 small">{error}</CAlert> : null}
    </div>
  )
}

CoSignerPicker.propTypes = {
  /** `{ coSignerToken, displayName, maskedPhone }` once confirmed, else null. */
  value: PropTypes.shape({
    coSignerToken: PropTypes.string,
    displayName: PropTypes.string,
    maskedPhone: PropTypes.string,
  }),
  onChange: PropTypes.func.isRequired,
  id: PropTypes.string,
  disabled: PropTypes.bool,
}

export default CoSignerPicker
