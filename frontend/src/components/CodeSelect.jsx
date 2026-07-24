/**
 * CodeSelect
 *
 * Reusable dropdown backed by a config Code's active values (see the Codes
 * admin module). Populates a `<select>` from `GET /codes/key/:key?activeOnly=true`
 * so forms can validate submitted values against the same source of truth the
 * backend uses (`codeService.validateCodeValue`).
 *
 * @example
 * <CodeSelect codeKey="GENDER" value={form.gender} onChange={(v) => setForm(f => ({...f, gender: v}))} required />
 *
 * @module components/CodeSelect
 */

import React from 'react'
import PropTypes from 'prop-types'
import { CFormSelect, CSpinner } from '@coreui/react'

import { useCodeByKey } from '../hooks/useCodes'

const CodeSelect = ({ codeKey, value, onChange, required, disabled, placeholder, className }) => {
  const { data: code, isLoading, error } = useCodeByKey(codeKey)
  const values = code?.values ?? []

  if (error) {
    return <div className="text-danger small">Failed to load {codeKey} options.</div>
  }

  return (
    <div className="d-flex align-items-center gap-2">
      <CFormSelect
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        required={required}
        disabled={disabled || isLoading}
        className={className}
      >
        <option value="">{placeholder}</option>
        {values.map((v) => (
          <option key={v.id} value={v.value}>
            {v.description || v.value}
          </option>
        ))}
      </CFormSelect>
      {isLoading && <CSpinner size="sm" />}
    </div>
  )
}

CodeSelect.propTypes = {
  codeKey: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string,
  className: PropTypes.string,
}

CodeSelect.defaultProps = {
  required: false,
  disabled: false,
  placeholder: 'Select…',
  className: undefined,
}

export default CodeSelect
