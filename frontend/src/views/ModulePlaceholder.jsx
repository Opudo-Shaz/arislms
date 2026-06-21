/**
 * ModulePlaceholder
 *
 * Temporary placeholder for portal modules that are scaffolded in the
 * navigation but implemented in a later build phase. Replace the route's
 * element with the real screen as each phase is delivered.
 *
 * @module views/ModulePlaceholder
 */

import React from 'react'
import PropTypes from 'prop-types'
import { CCard, CCardBody, CCardHeader } from '@coreui/react'

const ModulePlaceholder = ({ title, phase }) => (
  <CCard className="mb-4">
    <CCardHeader>
      <strong>{title}</strong>
    </CCardHeader>
    <CCardBody>
      <p className="text-body-secondary mb-1">This module is coming soon.</p>
      {phase ? <small className="text-body-secondary">Planned for {phase}.</small> : null}
    </CCardBody>
  </CCard>
)

ModulePlaceholder.propTypes = {
  title: PropTypes.string.isRequired,
  phase: PropTypes.string,
}

export default ModulePlaceholder
