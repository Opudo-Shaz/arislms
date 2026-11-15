/**
 * "Enter your code" form shared by every one-time-code flow: digit boxes, primary
 * verify button, and the back / resend / try-another-channel link row.
 *
 * The parent owns the code, the busy flag and the countdown; this component only
 * renders them. By default it submits as soon as the last digit lands (typed, pasted
 * or autofilled); pass `autoSubmit={false}` where the button press is a deliberate
 * confirmation (e.g. co-signer consent). Styled by the `.portal-*` classes, so it
 * must render inside `.portal-login` or `.portal-otp-surface`.
 *
 * @component
 */

import React from 'react'
import PropTypes from 'prop-types'
import { CAlert, CButton, CForm, CSpinner } from '@coreui/react'
import OtpCodeInput from './OtpCodeInput'
import { formatCountdown } from '../../utils/otp'

const OtpCodeEntry = ({
  title,
  titleAs: Title = 'h1',
  description,
  error = '',
  onDismissError,
  notice,
  code,
  onCodeChange,
  codeKey = 0,
  length = 6,
  submitting = false,
  autoSubmit = true,
  onSubmit,
  submitLabel = 'Verify and sign in',
  submittingLabel = 'Verifying…',
  resendIn = 0,
  onResend,
  alternative,
  backLabel,
  onBack,
}) => {
  const handleSubmit = (e) => {
    e.preventDefault()
    if (code.length === length && !submitting) onSubmit(code)
  }

  const handleChange = (next) => {
    onCodeChange(next)
    if (autoSubmit && next.length === length && !submitting) onSubmit(next)
  }

  return (
    <CForm onSubmit={handleSubmit}>
      {title ? <Title className="portal-heading">{title}</Title> : null}
      <p className="portal-subtext" aria-live="polite">
        {description}
      </p>
      {error ? (
        <CAlert color="danger" className="py-2 portal-alert" dismissible onClose={onDismissError}>
          {error}
        </CAlert>
      ) : null}
      {notice !== undefined ? (
        <div aria-live="polite" className="portal-help">
          {notice}
        </div>
      ) : null}
      <OtpCodeInput key={codeKey} value={code} onChange={handleChange} length={length} disabled={submitting} autoFocus />
      <CButton
        type="submit"
        className="portal-primary-btn mt-4"
        disabled={submitting || code.length !== length}
      >
        {submitting ? (
          <>
            <CSpinner size="sm" className="me-2" aria-hidden="true" />
            {submittingLabel}
          </>
        ) : (
          submitLabel
        )}
      </CButton>
      <div className="portal-linkrow">
        {onBack ? (
          <button type="button" className="portal-link" onClick={onBack} disabled={submitting}>
            {backLabel}
          </button>
        ) : (
          <span />
        )}
        <span className="portal-linkrow-end">
          {resendIn > 0 ? (
            <span className="portal-help m-0" aria-live="off">
              Resend in {formatCountdown(resendIn)}
            </span>
          ) : (
            <>
              <button type="button" className="portal-link" onClick={() => onResend()} disabled={submitting}>
                Resend code
              </button>
              {alternative ? (
                <button type="button" className="portal-link ms-3" onClick={alternative.onClick} disabled={submitting}>
                  {alternative.label}
                </button>
              ) : null}
            </>
          )}
        </span>
      </div>
    </CForm>
  )
}

OtpCodeEntry.propTypes = {
  title: PropTypes.string,
  titleAs: PropTypes.elementType,
  description: PropTypes.node.isRequired,
  error: PropTypes.string,
  onDismissError: PropTypes.func,
  notice: PropTypes.string,
  code: PropTypes.string.isRequired,
  onCodeChange: PropTypes.func.isRequired,
  codeKey: PropTypes.number,
  length: PropTypes.number,
  submitting: PropTypes.bool,
  autoSubmit: PropTypes.bool,
  onSubmit: PropTypes.func.isRequired,
  submitLabel: PropTypes.node,
  submittingLabel: PropTypes.node,
  resendIn: PropTypes.number,
  onResend: PropTypes.func.isRequired,
  alternative: PropTypes.shape({ label: PropTypes.string.isRequired, onClick: PropTypes.func.isRequired }),
  backLabel: PropTypes.string,
  onBack: PropTypes.func,
}

export default OtpCodeEntry
