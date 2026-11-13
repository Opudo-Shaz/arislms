/**
 * Six single-digit boxes for a one-time code.
 *
 * Auto-advances on entry, Backspace steps back, and pasting (or an SMS autofill)
 * of a full code fills every box. The value is a string of up to `length` digits.
 *
 * @component
 */

import React, { useRef } from 'react'
import PropTypes from 'prop-types'
import { CFormInput } from '@coreui/react'

const OtpCodeInput = ({ value, onChange, length = 6, disabled = false, autoFocus = false }) => {
  const refs = useRef([])
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  const focusBox = (i) => {
    const el = refs.current[Math.max(0, Math.min(length - 1, i))]
    if (el) {
      el.focus()
      el.select()
    }
  }

  // Replace the digits from `start` onward with `incoming`; returns the next box to focus.
  const fill = (start, incoming) => {
    const next = digits.slice()
    const clean = incoming.replace(/\D/g, '').slice(0, length - start)
    clean.split('').forEach((d, k) => {
      next[start + k] = d
    })
    onChange(next.join('').slice(0, length))
    return start + clean.length
  }

  const handleChange = (i, e) => {
    const raw = e.target.value.replace(/\D/g, '')
    if (!raw) {
      const next = digits.slice()
      next[i] = ''
      onChange(next.join(''))
      return
    }
    // Typing over a filled box leaves two digits; take the newest. Several digits means autofill.
    const incoming = raw.length > 2 ? raw : raw.slice(-1)
    const nextIndex = fill(i, incoming)
    focusBox(nextIndex)
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      e.preventDefault()
      const next = digits.slice()
      next[i - 1] = ''
      onChange(next.join(''))
      focusBox(i - 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focusBox(i - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      focusBox(i + 1)
    }
  }

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text')
    if (!/\d/.test(text)) return
    e.preventDefault()
    const clean = text.replace(/\D/g, '').slice(0, length)
    onChange(clean)
    focusBox(clean.length >= length ? length - 1 : clean.length)
  }

  return (
    <div role="group" aria-label="One-time code" className="portal-otp">
      {digits.map((d, i) => (
        <CFormInput
          // Position is the identity of a digit box.
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          className="portal-otp-box"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1}`}
          value={d}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  )
}

OtpCodeInput.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  length: PropTypes.number,
  disabled: PropTypes.bool,
  autoFocus: PropTypes.bool,
}

export default OtpCodeInput
