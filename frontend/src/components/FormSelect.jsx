/**
 * FormSelect
 *
 * Drop-in replacement for CoreUI's `CFormSelect` that renders a react-select
 * styled like ClientAsyncSelect (theme-aware, searchable) while keeping the
 * native API: `<option>` children, `value`, and `onChange(e)` where
 * `e.target.value` / `e.target.name` are populated. Options are filtered
 * client-side; nothing is sent to the backend.
 *
 * An `<option value="">` is kept in the menu and shown muted when selected,
 * so "All"/"Select…" entries still work as a reset.
 *
 * @module components/FormSelect
 */

import React, { Children, Fragment, isValidElement, useMemo } from 'react'
import Select from 'react-select'
import PropTypes from 'prop-types'
import { themedSelectStyles } from '../utils/selectStyles'

/** Collapse arbitrary React children into a plain string label. */
const textOf = (node) => {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement(node)) return textOf(node.props.children)
  return ''
}

/** Flatten <option> elements (including inside fragments/arrays) to options. */
const collectOptions = (children, out = []) => {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if (child.type === Fragment) {
      collectOptions(child.props.children, out)
    } else if (child.type === 'option') {
      const label = textOf(child.props.children)
      out.push({
        value: String(child.props.value ?? label),
        label,
        isDisabled: !!child.props.disabled,
      })
    }
  })
  return out
}

const SEARCH_THRESHOLD = 7

const FormSelect = ({
  value,
  onChange,
  children,
  id,
  name,
  required,
  disabled,
  size,
  className,
  style,
  invalid,
  'aria-label': ariaLabel,
}) => {
  const options = useMemo(() => collectOptions(children), [children])
  const current = String(value ?? '')
  const selected = options.find((o) => o.value === current) ?? null
  const isPlaceholder = !selected || selected.value === ''

  const styles = useMemo(
    () => ({
      ...themedSelectStyles,
      control: (base, state) => {
        const c = themedSelectStyles.control(base, state)
        return {
          ...c,
          minHeight: size === 'sm' ? '31px' : '38px',
          ...(invalid ? { borderColor: 'var(--cui-form-invalid-border-color, #e55353)' } : {}),
        }
      },
      singleValue: (base) => ({
        ...base,
        color: isPlaceholder ? 'var(--cui-secondary-color)' : 'var(--cui-body-color)',
      }),
      menuPortal: (base) => ({ ...base, zIndex: 2000 }),
    }),
    [size, invalid, isPlaceholder],
  )

  const handleChange = (opt) => {
    onChange?.({ target: { value: opt ? opt.value : '', name } })
  }

  return (
    <div className={className} style={{ position: 'relative', ...(style?.width === 'auto' ? { minWidth: '10rem' } : {}), ...style }}>
      <Select
        inputId={id}
        aria-label={ariaLabel}
        options={options}
        value={selected}
        onChange={handleChange}
        isDisabled={disabled}
        isSearchable={options.length >= SEARCH_THRESHOLD}
        isClearable={false}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
        menuPlacement="auto"
        placeholder="Select…"
        noOptionsMessage={() => 'No matching options'}
        styles={styles}
      />
      {required && (
        // Native required-validation proxy: react-select has no form control of its own.
        <input
          tabIndex={-1}
          autoComplete="off"
          required
          value={current}
          onChange={() => {}}
          style={{
            position: 'absolute',
            inset: 'auto 0 0 0',
            height: 1,
            opacity: 0,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}

FormSelect.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  children: PropTypes.node,
  id: PropTypes.string,
  name: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  size: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object,
  invalid: PropTypes.bool,
  'aria-label': PropTypes.string,
}

export default FormSelect
