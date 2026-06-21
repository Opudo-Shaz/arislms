/**
 * StatusBadge
 *
 * Renders a CoreUI badge for an enum value using the shared color/label maps
 * from `src/constants/enums`.
 *
 * @example
 * import { LOAN_STATUS } from 'src/constants/enums'
 * <StatusBadge enumDef={LOAN_STATUS} value={loan.status} />
 *
 * @module components/StatusBadge
 */

import React from 'react'
import PropTypes from 'prop-types'
import { CBadge } from '@coreui/react'
import { badgeColor, enumLabel } from '../constants/enums'

const StatusBadge = ({ enumDef, value, className }) => {
  if (!value) return <span className="text-body-secondary">—</span>
  return (
    <CBadge color={badgeColor(enumDef, value)} className={className}>
      {enumLabel(enumDef, value)}
    </CBadge>
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
