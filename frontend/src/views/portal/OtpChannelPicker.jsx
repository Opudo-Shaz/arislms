/**
 * "Send my code by" segmented control (SMS / WhatsApp / Email).
 *
 * A radiogroup with roving tabindex and arrow-key navigation. Each option may carry a
 * `detail` line (e.g. the masked destination). Styled by the `.portal-*` classes, so it
 * must render inside `.portal-login` or `.portal-otp-surface`.
 *
 * @component
 */

import React from 'react'
import PropTypes from 'prop-types'

const OtpChannelPicker = ({ options, value, onChange, label = 'Send my code by', id = 'otp-channel', hint = '' }) => {
  const handleKeyDown = (e, index) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const nextIndex = (index + step + options.length) % options.length
    onChange(options[nextIndex].value)
    e.currentTarget.parentElement.children[nextIndex]?.focus()
  }

  return (
    <div className="portal-channels">
      <div id={`${id}-label`} className="portal-label">
        {label}
      </div>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="portal-segmented">
        {options.map((option, i) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              className={`portal-segment ${selected ? 'is-selected' : ''}`}
              onClick={() => onChange(option.value)}
              onKeyDown={(e) => handleKeyDown(e, i)}
            >
              {selected ? (
                <span className="portal-segment-check" aria-hidden="true">
                  ✓
                </span>
              ) : null}
              <span className="portal-segment-text">
                {option.label}
                {option.detail ? <span className="portal-segment-detail">{option.detail}</span> : null}
              </span>
            </button>
          )
        })}
      </div>
      <div aria-live="polite" className="portal-help">
        {hint}
      </div>
    </div>
  )
}

OtpChannelPicker.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      detail: PropTypes.string,
    }),
  ).isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  id: PropTypes.string,
  hint: PropTypes.string,
}

export default OtpChannelPicker
