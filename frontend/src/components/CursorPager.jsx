/**
 * CursorPager
 *
 * Footer for keyset-paginated lists: a summary on the left and Previous/Next
 * driven by the backend's `pagination` ({ hasNext, hasPrev, nextCursor,
 * prevCursor }). There's no total or page number by design.
 *
 * @module components/CursorPager
 */

import React from 'react'
import PropTypes from 'prop-types'
import { CPagination, CPaginationItem } from '@coreui/react'

const CursorPager = ({ pagination, onNavigate, disabled = false, summary = null }) => {
  const hasPrev = Boolean(pagination?.hasPrev && pagination?.prevCursor)
  const hasNext = Boolean(pagination?.hasNext && pagination?.nextCursor)

  return (
    <div className="d-flex justify-content-between align-items-center mt-3">
      <span className="small text-body-secondary">{summary}</span>
      {(hasPrev || hasNext) && (
        <CPagination className="mb-0">
          <CPaginationItem
            disabled={!hasPrev || disabled}
            onClick={() => onNavigate(pagination.prevCursor, 'prev')}
          >
            Previous
          </CPaginationItem>
          <CPaginationItem
            disabled={!hasNext || disabled}
            onClick={() => onNavigate(pagination.nextCursor, 'next')}
          >
            Next
          </CPaginationItem>
        </CPagination>
      )}
    </div>
  )
}

CursorPager.propTypes = {
  pagination: PropTypes.shape({
    hasNext: PropTypes.bool,
    hasPrev: PropTypes.bool,
    nextCursor: PropTypes.string,
    prevCursor: PropTypes.string,
  }),
  onNavigate: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  summary: PropTypes.node,
}

export default CursorPager
