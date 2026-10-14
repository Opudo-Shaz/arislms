/**
 * Compact KPI tile: uppercase title, headline value, optional sub-line and
 * icon, with a coloured left accent. Used by the staff and client dashboards.
 *
 * @component
 */

import React from 'react'
import PropTypes from 'prop-types'
import { CCard, CCardBody } from '@coreui/react'
import CIcon from '@coreui/icons-react'

const KpiCard = ({ title, value, sub, color = 'primary', icon }) => (
  <CCard
    className='mb-0 h-100'
    style={{ borderLeft: `4px solid var(--cui-${color})` }}
  >
    <CCardBody className='py-3 px-3'>
      <div className='d-flex justify-content-between align-items-center mb-1'>
        <div className='text-body-secondary small fw-semibold text-uppercase'>{title}</div>
        {icon && (
          <CIcon
            icon={icon}
            style={{ color: `var(--cui-${color})`, opacity: 0.6 }}
            size='xl'
          />
        )}
      </div>
      <div className='fs-4 fw-bold'>{value}</div>
      {sub && <div className='text-body-secondary small mt-1'>{sub}</div>}
    </CCardBody>
  </CCard>
)

KpiCard.propTypes = {
  title: PropTypes.node.isRequired,
  value: PropTypes.node,
  sub: PropTypes.node,
  color: PropTypes.string,
  icon: PropTypes.any,
}

export default KpiCard
