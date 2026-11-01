/**
 * RoleSelector
 *
 * Multi-select for a user's roles. A user can hold several roles; the only
 * rule is that `loan_notifications_receiver` (a companion role) can't be the
 * only one — see `validateRoleSelection`.
 * Value is an array of role ids as strings; use `toRoleIds` for the API payload.
 *
 * @module components/RoleSelector
 */

import React, { useMemo } from 'react'
import PropTypes from 'prop-types'
import Select from 'react-select'
import { CCol, CFormLabel } from '@coreui/react'
import { themedSelectStyles } from '../utils/selectStyles'
import { LOAN_NOTIFICATIONS_RECEIVER_ROLE } from '../constants/enums'

/** Role ids (strings) -> API `roles` array of numbers. */
export const toRoleIds = (value = []) => value.map(Number)

/** Returns an error message when the selection is invalid, otherwise null. */
export const validateRoleSelection = (value, roles) => {
  if (!value.length) return 'Select at least one role.'
  const companionIds = new Set(
    roles.filter((r) => r.name === LOAN_NOTIFICATIONS_RECEIVER_ROLE).map((r) => String(r.id)),
  )
  if (value.every((id) => companionIds.has(id))) {
    return `"${LOAN_NOTIFICATIONS_RECEIVER_ROLE}" must accompany another role — select at least one more.`
  }
  return null
}

const styles = {
  ...themedSelectStyles,
  menuPortal: (base) => ({ ...base, zIndex: 2000 }),
  multiValue: (base) => ({ ...base, backgroundColor: 'var(--cui-tertiary-bg)' }),
  multiValueLabel: (base) => ({ ...base, color: 'var(--cui-body-color)' }),
}

const RoleSelector = ({ roles, value, onChange, disabled = false, md = 4 }) => {
  const options = useMemo(() => roles.map((r) => ({ value: String(r.id), label: r.name })), [roles])
  const selected = options.filter((o) => value.includes(o.value))

  return (
    <CCol md={md}>
      <CFormLabel>Roles <span className="text-danger">*</span></CFormLabel>
      <Select
        isMulti
        isDisabled={disabled}
        options={options}
        value={selected}
        onChange={(opts) => onChange((opts ?? []).map((o) => o.value))}
        placeholder="Select roles…"
        closeMenuOnSelect={false}
        styles={styles}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
        menuPosition="fixed"
      />
      <div className="form-text">
        Add <code>{LOAN_NOTIFICATIONS_RECEIVER_ROLE}</code> alongside a main role to receive loan notifications.
      </div>
    </CCol>
  )
}

RoleSelector.propTypes = {
  roles: PropTypes.arrayOf(PropTypes.object).isRequired,
  value: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  md: PropTypes.number,
}

export default RoleSelector
