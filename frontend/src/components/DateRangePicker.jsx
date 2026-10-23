/**
 * DateRangePicker
 *
 * Inline range-picker panel built on react-day-picker: two-month calendar with
 * month/year dropdowns, quick-range shortcuts, typed From/To inputs and an
 * explicit Apply step so consumers only receive complete ranges. With
 * `withTime`, From/To time inputs are added and applied dates carry that time.
 * Themed through CoreUI CSS variables (light/dark).
 *
 * @module components/DateRangePicker
 */

import React, { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { DayPicker } from 'react-day-picker'
import {
  addDays,
  endOfMonth,
  endOfYear,
  format,
  isValid,
  parse,
  startOfMonth,
  startOfYear,
  subDays,
  subYears,
} from 'date-fns'
import { CButton, CFormInput } from '@coreui/react'
import 'react-day-picker/style.css'

const ISO = 'yyyy-MM-dd'

const shortcuts = (today) => [
  { label: 'Today', range: [today, today] },
  { label: 'Last 7 days', range: [subDays(today, 6), today] },
  { label: 'Last 30 days', range: [subDays(today, 29), today] },
  { label: 'Last 90 days', range: [subDays(today, 89), today] },
  { label: 'Year to date', range: [startOfYear(today), today] },
  {
    label: 'Last year',
    range: [startOfYear(subYears(today, 1)), endOfYear(subYears(today, 1))],
  },
]

const TIME = 'HH:mm'

const DateRangePicker = ({ from, to, onApply, onCancel, maxDate, startYear = 2015, withTime = false }) => {
  const today = useMemo(() => new Date(), [])
  const [range, setRange] = useState({ from, to })
  const [month, setMonth] = useState(from ?? startOfMonth(today))
  const [fromTime, setFromTime] = useState(from ? format(from, TIME) : '00:00')
  const [toTime, setToTime] = useState(to ? format(to, TIME) : '23:59')
  // type="date" inputs emit a full ISO value or '' — derive them from `range`.
  const fromText = range.from ? format(range.from, ISO) : ''
  const toText = range.to ? format(range.to, ISO) : ''

  const clamp = (d) => (maxDate && d > maxDate ? maxDate : d)

  const applyTyped = (text, key) => {
    const d = parse(text, ISO, new Date())
    if (!text) {
      setRange({ ...range, [key]: undefined })
      return
    }
    if (!isValid(d) || (maxDate && d > maxDate)) return
    const next = { ...range, [key]: d }
    if (next.from && next.to && next.from > next.to) {
      // Typing a start after the end (or vice-versa) collapses to that day.
      next[key === 'from' ? 'to' : 'from'] = d
    }
    setRange(next)
    setMonth(next.from ?? d)
  }

  const handleSelect = (next, triggerDate) => {
    // Starting a fresh selection after a complete range: begin again from the clicked day.
    if (range.from && range.to && triggerDate) {
      setRange({ from: triggerDate, to: undefined })
      return
    }
    setRange(next ?? { from: undefined, to: undefined })
  }

  const complete = !!range.from
  const withClock = (date, time, seconds) => {
    if (!withTime) return date
    const [h, m] = (time || '00:00').split(':').map(Number)
    const d = new Date(date)
    d.setHours(h, m, seconds, seconds ? 999 : 0)
    return d
  }
  const apply = () => {
    if (!complete) return
    const start = withClock(range.from, fromTime, 0)
    const end = withClock(clamp(range.to ?? range.from), toTime, 59)
    // Same-day ranges with an inverted time window collapse to the start time.
    onApply(start, end < start ? start : end)
  }

  return (
    <div className="rdp-panel border rounded-3 bg-body shadow-sm mb-3">
      <div className="d-flex flex-column flex-md-row">
        <div className="rdp-shortcuts d-flex flex-md-column flex-wrap gap-1 p-2 border-bottom border-md-0">
          {shortcuts(today).map((s) => (
            <CButton
              key={s.label}
              color="light"
              size="sm"
              className="text-start text-nowrap"
              onClick={() => {
                const [f, t] = s.range
                setRange({ from: f, to: clamp(t) })
                setMonth(f)
              }}
            >
              {s.label}
            </CButton>
          ))}
        </div>

        <div className="p-2 flex-grow-1 overflow-auto">
          <DayPicker
            mode="range"
            selected={range}
            onSelect={handleSelect}
            month={month}
            onMonthChange={setMonth}
            numberOfMonths={2}
            pagedNavigation
            captionLayout="dropdown"
            startMonth={new Date(startYear, 0)}
            endMonth={maxDate ? endOfMonth(maxDate) : endOfYear(addDays(today, 365))}
            disabled={maxDate ? { after: maxDate } : undefined}
            showOutsideDays
            fixedWeeks
          />
        </div>
      </div>

      <div className="d-flex flex-wrap align-items-center gap-2 p-2 border-top">
        <CFormInput
          size="sm"
          type="date"
          aria-label="From date"
          value={fromText}
          max={maxDate ? format(maxDate, ISO) : undefined}
          onChange={(e) => {
            applyTyped(e.target.value, 'from')
          }}
          style={{ width: '9.5rem' }}
        />
        {withTime && (
          <CFormInput
            size="sm"
            type="time"
            aria-label="From time"
            value={fromTime}
            onChange={(e) => setFromTime(e.target.value)}
            style={{ width: '6.5rem' }}
          />
        )}
        <span className="text-body-secondary">→</span>
        <CFormInput
          size="sm"
          type="date"
          aria-label="To date"
          value={toText}
          max={maxDate ? format(maxDate, ISO) : undefined}
          onChange={(e) => {
            applyTyped(e.target.value, 'to')
          }}
          style={{ width: '9.5rem' }}
        />
        {withTime && (
          <CFormInput
            size="sm"
            type="time"
            aria-label="To time"
            value={toTime}
            onChange={(e) => setToTime(e.target.value)}
            style={{ width: '6.5rem' }}
          />
        )}
        {range.from && !range.to && (
          <small className="text-warning">Pick an end date (or Apply for a single day)</small>
        )}
        <div className="ms-auto d-flex gap-2">
          <CButton color="secondary" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </CButton>
          <CButton color="primary" size="sm" disabled={!complete} onClick={apply}>
            Apply
          </CButton>
        </div>
      </div>
    </div>
  )
}

DateRangePicker.propTypes = {
  from: PropTypes.instanceOf(Date),
  to: PropTypes.instanceOf(Date),
  onApply: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  maxDate: PropTypes.instanceOf(Date),
  startYear: PropTypes.number,
  withTime: PropTypes.bool,
}

export default DateRangePicker
