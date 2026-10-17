/**
 * PhoneInput
 *
 * Country-code select (East Africa) + national number input. The value is the
 * full E.164 string (e.g. "+254712345678") or '' when no number is entered.
 * Leading zeros on the national number are stripped before the dial code is added.
 *
 * @module components/PhoneInput
 */

import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { CFormInput, CFormSelect, CInputGroup } from '@coreui/react'

export const PHONE_COUNTRIES = [
  { iso: 'KE', name: 'Kenya', dial: '+254' },
  { iso: 'UG', name: 'Uganda', dial: '+256' },
  { iso: 'TZ', name: 'Tanzania', dial: '+255' },
  { iso: 'RW', name: 'Rwanda', dial: '+250' },
  { iso: 'BI', name: 'Burundi', dial: '+257' },
  { iso: 'SS', name: 'South Sudan', dial: '+211' },
  { iso: 'CD', name: 'DR Congo', dial: '+243' },
  { iso: 'SO', name: 'Somalia', dial: '+252' },
]

const DEFAULT_DIAL = PHONE_COUNTRIES[0].dial
const MAX_NATIONAL_DIGITS = 12

// ISO alpha-2 -> flag emoji via regional indicator symbols.
const flagOf = (iso) => String.fromCodePoint(...[...iso].map((ch) => 0x1f1a5 + ch.charCodeAt(0)))

const cleanNational = (raw) => String(raw).replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_NATIONAL_DIGITS)

const compose = (dial, national) => (national ? `${dial}${national}` : '')

// 11+ digits can't be a local number, so a leading dial code (with or without "+") means international.
const isInternational = (v) => v.trim().startsWith('+') || v.replace(/\D/g, '').length >= 11

/** Split a stored/pasted number into { dial, national }; bare numbers default to Kenya. */
const parse = (value) => {
  const v = String(value || '').trim()
  if (isInternational(v)) {
    const digits = v.replace(/\D/g, '')
    const country = PHONE_COUNTRIES.find((c) => digits.startsWith(c.dial.slice(1)))
    if (country) return { dial: country.dial, national: cleanNational(digits.slice(country.dial.length - 1)) }
  }
  return { dial: DEFAULT_DIAL, national: cleanNational(v) }
}

const PhoneInput = ({ value, onChange, required, invalid, disabled, onKeyDown, id, placeholder }) => {
  // Remembers the chosen country while no number has been typed yet.
  const [emptyDial, setEmptyDial] = useState(DEFAULT_DIAL)
  const { dial, national } = value ? parse(value) : { dial: emptyDial, national: '' }

  const handleDial = (e) => {
    setEmptyDial(e.target.value)
    onChange(compose(e.target.value, national))
  }

  const handleNational = (e) => {
    const raw = e.target.value
    if (isInternational(raw)) {
      const parsed = parse(raw)
      setEmptyDial(parsed.dial)
      onChange(compose(parsed.dial, parsed.national))
      return
    }
    onChange(compose(dial, cleanNational(raw)))
  }

  return (
    <CInputGroup>
      <CFormSelect
        value={dial}
        onChange={handleDial}
        aria-label="Country code"
        disabled={disabled}
        style={{
          flex: '0 0 auto',
          width: '8.5rem',
          backgroundColor: 'var(--cui-tertiary-bg)',
          fontWeight: 500,
        }}
      >
        {PHONE_COUNTRIES.map((c) => (
          <option key={c.iso} value={c.dial} title={c.name}>
            {flagOf(c.iso)} {c.dial}
          </option>
        ))}
      </CFormSelect>
      <CFormInput
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder={placeholder}
        value={national}
        onChange={handleNational}
        required={required}
        invalid={invalid}
        disabled={disabled}
        onKeyDown={onKeyDown}
      />
    </CInputGroup>
  )
}

PhoneInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  required: PropTypes.bool,
  invalid: PropTypes.bool,
  disabled: PropTypes.bool,
  onKeyDown: PropTypes.func,
  id: PropTypes.string,
  placeholder: PropTypes.string,
}

export default PhoneInput
