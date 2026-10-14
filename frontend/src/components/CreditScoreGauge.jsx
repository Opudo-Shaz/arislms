/**
 * Semicircular gauge for a credit score on the backend's 0–5 scale
 * (creditScorerService → riskPolicyService). The track runs from danger (red)
 * through warning (amber) to success (green) using CoreUI theme tokens, so it
 * follows light/dark mode. A needle marks the score and tick marks show the
 * policy thresholds: 3 = manual review, 4 = automatic pre-approval.
 *
 * Colour is never the only signal: the score, grade and a status label with
 * an icon are always rendered as text.
 *
 * @component
 */

import React, { useId } from 'react'
import PropTypes from 'prop-types'
import CIcon from '@coreui/icons-react'
import { cilCheckCircle, cilWarning, cilXCircle } from '@coreui/icons'
import { formatCurrency, formatDate } from '../utils/format'

const MAX_SCORE = 5
const THRESHOLDS = [
  { value: 3, label: 'Review' },
  { value: 4, label: 'Pre-approve' },
]

// Geometry (SVG user units). The arc is the top half of a circle.
const CX = 100
const CY = 100
const R = 80
const STROKE = 16

/** Score → point on the arc. 0 sits at the left end, MAX_SCORE at the right. */
const pointAt = (score, radius = R) => {
  const angle = Math.PI - (Math.min(Math.max(score, 0), MAX_SCORE) / MAX_SCORE) * Math.PI
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) }
}

/** Status band for a score — mirrors riskPolicyService.getDecisionFromScore. */
export const scoreStatus = (score) => {
  if (score >= 4) return { color: 'success', icon: cilCheckCircle, label: 'Good', detail: 'Eligible for automatic pre-approval' }
  if (score >= 3) return { color: 'warning', icon: cilWarning, label: 'Fair', detail: 'Applications go to manual review' }
  return { color: 'danger', icon: cilXCircle, label: 'Low', detail: 'Below the pre-approval threshold' }
}

const CreditScoreGauge = ({ score, grade, creditLimit, currency, scoredAt, compact }) => {
  const gradientId = `csg-${useId().replace(/:/g, '')}`

  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return (
      <div className="text-body-secondary small text-center py-3">
        No credit score yet. A score is calculated when a loan application is assessed.
      </div>
    )
  }

  const value = Number(score)
  const status = scoreStatus(value)
  const start = pointAt(0)
  const end = pointAt(MAX_SCORE)
  const needleTip = pointAt(value, R - STROKE / 2 - 6)
  const marker = pointAt(value)
  const arcPath = `M ${start.x} ${start.y} A ${R} ${R} 0 0 1 ${end.x} ${end.y}`

  return (
    <div
      className="text-center"
      role="img"
      aria-label={`Credit score ${value} out of ${MAX_SCORE}, grade ${grade || 'unrated'}: ${status.label}. ${status.detail}.`}
    >
      <svg
        viewBox="0 0 200 124"
        style={{ width: '100%', maxWidth: compact ? 200 : 280, display: 'block', margin: '0 auto' }}
        aria-hidden="true"
      >
        <title>{`Score ${value} / ${MAX_SCORE} · ${status.label}`}</title>
        <defs>
          <linearGradient id={gradientId} x1={start.x} y1="0" x2={end.x} y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" style={{ stopColor: 'var(--cui-danger)' }} />
            <stop offset="50%" style={{ stopColor: 'var(--cui-warning)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--cui-success)' }} />
          </linearGradient>
        </defs>

        {/* Scale track */}
        <path d={arcPath} fill="none" stroke={`url(#${gradientId})`} strokeWidth={STROKE} strokeLinecap="round" />

        {/* Policy threshold ticks (cut through the track in the surface colour) */}
        {THRESHOLDS.map((t) => {
          const inner = pointAt(t.value, R - STROKE / 2 - 1)
          const outer = pointAt(t.value, R + STROKE / 2 + 1)
          const lbl = pointAt(t.value, R + STROKE / 2 + 9)
          return (
            <g key={t.value}>
              <line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                style={{ stroke: 'var(--cui-body-bg)' }}
                strokeWidth={2.5}
              />
              <text
                x={lbl.x}
                y={lbl.y}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ fill: 'var(--cui-secondary-color)', fontSize: 7 }}
              >
                {t.value}
              </text>
            </g>
          )
        })}

        {/* End labels */}
        <text x={start.x} y={CY + STROKE + 4} textAnchor="middle" style={{ fill: 'var(--cui-secondary-color)', fontSize: 8 }}>
          0
        </text>
        <text x={end.x} y={CY + STROKE + 4} textAnchor="middle" style={{ fill: 'var(--cui-secondary-color)', fontSize: 8 }}>
          {MAX_SCORE}
        </text>

        {/* Score marker on the track + needle */}
        <circle cx={marker.x} cy={marker.y} r={STROKE / 2 + 2} style={{ fill: 'var(--cui-body-bg)' }} />
        <circle cx={marker.x} cy={marker.y} r={STROKE / 2 - 2} style={{ fill: `var(--cui-${status.color})` }} />
        <line
          x1={CX}
          y1={CY}
          x2={needleTip.x}
          y2={needleTip.y}
          style={{ stroke: 'var(--cui-body-color)' }}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <circle cx={CX} cy={CY} r={4} style={{ fill: 'var(--cui-body-color)' }} />
      </svg>

      <div className={compact ? 'mt-1' : 'mt-2'}>
        <span className={compact ? 'fs-4 fw-semibold' : 'fs-2 fw-semibold'}>{value}</span>
        <span className="text-body-secondary"> / {MAX_SCORE}</span>
        {grade ? <span className="ms-2 text-body-secondary">Grade {grade}</span> : null}
      </div>
      <div className="d-inline-flex align-items-center gap-1 small mt-1">
        <CIcon icon={status.icon} className={`text-${status.color}`} />
        <span className="fw-semibold">{status.label}</span>
        <span className="text-body-secondary">— {status.detail}</span>
      </div>
      {!compact && (creditLimit != null || scoredAt) ? (
        <div className="small text-body-secondary mt-2">
          {creditLimit != null ? (
            <span>
              Credit limit <span className="fw-semibold text-body">{formatCurrency(creditLimit, currency)}</span>
            </span>
          ) : null}
          {creditLimit != null && scoredAt ? <span className="mx-2">·</span> : null}
          {scoredAt ? <span>Scored {formatDate(scoredAt)}</span> : null}
        </div>
      ) : null}
    </div>
  )
}

CreditScoreGauge.propTypes = {
  score: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  grade: PropTypes.string,
  creditLimit: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  currency: PropTypes.string,
  scoredAt: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  /** Smaller variant for table-adjacent cards. */
  compact: PropTypes.bool,
}

export default CreditScoreGauge
