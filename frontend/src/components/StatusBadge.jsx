/**
 * StatusBadge
 *
 * Renders a soft "pill" badge for an enum value using the shared color/label
 * maps from `src/constants/enums`. Uses Bootstrap/CoreUI's theme-aware
 * `-subtle`/`-emphasis` color utilities (already customized in
 * `src/scss/style.scss`) instead of a solid fill, so it automatically
 * softens/desaturates in dark mode without any extra CSS.
 *
 * @example
 * import { LOAN_STATUS } from 'src/constants/enums'
 * <StatusBadge enumDef={LOAN_STATUS} value={loan.status} />
 *
 * @module components/StatusBadge
 */

import React from 'react'
import PropTypes from 'prop-types'
import { badgeColor, enumLabel } from '../constants/enums'

const StatusBadge = ({ enumDef, value, className }) => {
  if (!value) return <span className="text-body-secondary">—</span>
  const color = badgeColor(enumDef, value)
  return (
    <span
      className={`badge rounded-pill fw-medium px-2 py-1 bg-${color}-subtle text-${color}-emphasis border border-${color}-subtle${
        className ? ` ${className}` : ''
      }`}
    >
      {enumLabel(enumDef, value)}
    </span>
  )
}

StatusBadge.propTypes = {
  enumDef: PropTypes.shape({
    colors: PropTypes.object.isRequired,
    labels: PropTypes.object.isRequired,
  }).isRequired,
  value: PropTypes.string,
  className: PropTypes.string,
}

export default StatusBadge
