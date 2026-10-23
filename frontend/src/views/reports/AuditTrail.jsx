/**
 * AuditTrail
 *
 * Paginated, filterable view of the system audit log. Filters by entity type,
 * action, actor type, and a date + time range. Keyset (cursor) paginated: Previous/Next only.
 *
 * @module views/reports/AuditTrail
 */

import React, { useMemo, useState } from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CModal,
  CModalBody,
  CModalHeader,
  CModalTitle,
  CRow,
} from '@coreui/react'
import FormSelect from '../../components/FormSelect'
import CIcon from '@coreui/icons-react'
import { cilCalendar, cilReload, cilX } from '@coreui/icons'
import { endOfDay, format } from 'date-fns'

import DataTable from '../../components/DataTable'
import CursorPager from '../../components/CursorPager'
import DateRangePicker from '../../components/DateRangePicker'
import StatusBadge from '../../components/StatusBadge'
import { useAuditLogs } from '../../hooks/useAudits'
import { useCursorPagination } from '../../hooks/useCursorPagination'
import { ACTOR_TYPE, AUDIT_ACTION } from '../../constants/enums'
import { formatDateTime } from '../../utils/format'

const PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a raw User-Agent string into a short "Browser vN / OS" label.
 * Handles the literal strings 'system' and 'unknown' that the backend emits
 * for automated/internal actions. Order matters: Edge/OPR before Chrome;
 * Firefox before Safari.
 */
const formatUserAgent = (ua) => {
  if (!ua) return '—'

  // Short literal values emitted by backend for non-browser actors
  const LITERALS = {
    system: 'System',
    unknown: 'Unknown',
  }
  if (LITERALS[ua.toLowerCase()]) return LITERALS[ua.toLowerCase()]

  const BROWSERS = [
    [/Edg\/(\d+)/, 'Edge'],
    [/OPR\/(\d+)/, 'Opera'],
    [/SamsungBrowser\/(\d+)/, 'Samsung'],
    [/Chrome\/(\d+)/, 'Chrome'],
    [/Firefox\/(\d+)/, 'Firefox'],
    [/Version\/(\d+).*Safari/, 'Safari'],
    [/MSIE (\d+)/, 'IE'],
    [/Trident.*rv:(\d+)/, 'IE'],
  ]
  let browser = 'Unknown'
  for (const [re, name] of BROWSERS) {
    const m = ua.match(re)
    if (m) {
      browser = `${name} ${m[1]}`
      break
    }
  }

  const OSES = [
    [/Android/, 'Android'],
    [/iPhone|iPad/, 'iOS'],
    [/Windows NT/, 'Windows'],
    [/Mac OS X/, 'macOS'],
    [/Linux/, 'Linux'],
  ]
  let os = ''
  for (const [re, name] of OSES) {
    if (re.test(ua)) {
      os = name
      break
    }
  }

  return os ? `${browser} / ${os}` : browser
}

/** Stringify a command payload and return the first N characters. */
const truncateJson = (value, len = 20) => {
  if (value === null || value === undefined) return null
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  return str.length > len ? str.slice(0, len) + '…' : str
}

const RANGE_FORMAT = 'dd MMM yyyy HH:mm'

const rangeLabel = ({ from, to }) =>
  from && to ? `${format(from, RANGE_FORMAT)} → ${format(to, RANGE_FORMAT)}` : ''

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AuditTrail = () => {
  const [entityType, setEntityType] = useState('')
  const [action, setAction] = useState('')
  const [actorType, setActorType] = useState('')
  const [range, setRange] = useState({ from: undefined, to: undefined })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [jsonEntry, setJsonEntry] = useState(null)
  const today = useMemo(() => endOfDay(new Date()), [])

  const filters = {
    entityType,
    action,
    actorType,
    startDate: range.from ? range.from.toISOString() : '',
    endDate: range.to ? range.to.toISOString() : '',
  }
  const { cursorParams, goTo } = useCursorPagination(filters)
  const params = { ...filters, ...cursorParams, limit: PAGE_SIZE }
  const { data, isLoading, error, refetch, isFetching } = useAuditLogs(params)

  const logs = data?.logs ?? []

  const columns = useMemo(
    () => [
      { key: 'audit_id', label: 'ID', render: (r) => <span className="fw-semibold">{r.audit_id}</span> },
      { key: 'occurred_at', label: 'When', render: (r) => formatDateTime(r.occurred_at) },
      { key: 'entity_type', label: 'Entity', render: (r) => `${r.entity_type} #${r.entity_id}` },
      { key: 'action', label: 'Action', render: (r) => <StatusBadge enumDef={AUDIT_ACTION} value={r.action} /> },
      {
        key: 'actor',
        label: 'Actor',
        render: (r) => {
          const name = r.actor
            ? [r.actor.first_name, r.actor.last_name].filter(Boolean).join(' ')
            : null
          return (
            <span>
              {name ? (
                <span title={`${ACTOR_TYPE.labels[r.actor_type] || r.actor_type} #${r.actor_id}`}>{name}</span>
              ) : (
                <span className="text-body-secondary">#{r.actor_id}</span>
              )}
              <StatusBadge enumDef={ACTOR_TYPE} value={r.actor_type} className="ms-2" />
            </span>
          )
        },
      },
      {
        key: 'command_as_json',
        label: 'Command',
        render: (r) => {
          const preview = truncateJson(r.command_as_json)
          if (!preview) return <span className="text-body-secondary">—</span>
          return (
            <button
              type="button"
              className="btn btn-link btn-sm p-0 font-monospace text-start text-truncate"
              style={{ maxWidth: 160, fontSize: '0.75rem' }}
              title="Click to view full JSON"
              onClick={(e) => {
                e.stopPropagation()
                setJsonEntry(r.command_as_json)
              }}
            >
              {preview}
            </button>
          )
        },
      },
      {
        key: 'source',
        label: 'Source',
        render: (r) => (
          <span title={r.source || undefined} className="text-nowrap">
            {formatUserAgent(r.source)}
          </span>
        ),
      },
    ],
    [],
  )

  return (
    <>
      <CCard className="mb-4">
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <strong>Audit Trail</strong>
          <CButton color="light" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <CIcon icon={cilReload} className="me-1" />
            Refresh
          </CButton>
        </CCardHeader>
        <CCardBody>
          <CRow className="g-2 mb-3">
            <CCol md={3}>
              <CFormInput
                placeholder="Entity type (e.g. LOAN, CLIENT)"
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
              />
            </CCol>
            <CCol md={3}>
              <FormSelect value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="">All actions</option>
                {AUDIT_ACTION.values.map((v) => (
                  <option key={v} value={v}>
                    {AUDIT_ACTION.labels[v]}
                  </option>
                ))}
              </FormSelect>
            </CCol>
            <CCol md={3}>
              <FormSelect value={actorType} onChange={(e) => setActorType(e.target.value)}>
                <option value="">All actor types</option>
                {ACTOR_TYPE.values.map((v) => (
                  <option key={v} value={v}>
                    {ACTOR_TYPE.labels[v]}
                  </option>
                ))}
              </FormSelect>
            </CCol>
            <CCol md={3} className="position-relative">
              <CInputGroup>
                <CInputGroupText role="button" onClick={() => setPickerOpen((o) => !o)}>
                  <CIcon icon={cilCalendar} />
                </CInputGroupText>
                <CFormInput
                  readOnly
                  placeholder="Date & time range"
                  aria-label="Date and time range"
                  aria-expanded={pickerOpen}
                  className="bg-transparent text-truncate"
                  style={{ cursor: 'pointer' }}
                  value={rangeLabel(range)}
                  onClick={() => setPickerOpen((o) => !o)}
                />
                {range.from && (
                  <CButton
                    color="secondary"
                    variant="outline"
                    aria-label="Clear date range"
                    onClick={() => {
                      setRange({ from: undefined, to: undefined })
                      setPickerOpen(false)
                    }}
                  >
                    <CIcon icon={cilX} size="sm" />
                  </CButton>
                )}
              </CInputGroup>
              {pickerOpen && (
                <div
                  className="position-absolute end-0 mt-1"
                  style={{ zIndex: 1050, width: 'max-content', maxWidth: 'calc(100vw - 2rem)' }}
                >
                  <DateRangePicker
                    withTime
                    from={range.from}
                    to={range.to}
                    maxDate={today}
                    onCancel={() => setPickerOpen(false)}
                    onApply={(from, to) => {
                      setRange({ from, to })
                      setPickerOpen(false)
                    }}
                  />
                </div>
              )}
            </CCol>
          </CRow>

          <DataTable
            columns={columns}
            rows={logs}
            loading={isLoading}
            error={error}
            emptyMessage="No audit entries match your filters."
            rowKey={(r) => r.audit_id}
          />

          <CursorPager
            pagination={data?.pagination}
            onNavigate={goTo}
            disabled={isFetching}
            summary={`Showing ${logs.length} entr${logs.length === 1 ? 'y' : 'ies'}`}
          />
        </CCardBody>
      </CCard>

      {/* JSON detail modal */}
      <CModal
        visible={jsonEntry !== null}
        onClose={() => setJsonEntry(null)}
        alignment="center"
        size="lg"
        scrollable
      >
        <CModalHeader>
          <CModalTitle>Command Payload</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <pre
            className="p-3 bg-body-tertiary rounded"
            style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
          >
            {jsonEntry !== null
              ? JSON.stringify(
                  typeof jsonEntry === 'string' ? JSON.parse(jsonEntry) : jsonEntry,
                  null,
                  2,
                )
              : ''}
          </pre>
        </CModalBody>
      </CModal>
    </>
  )
}

export default AuditTrail
