/**
 * AuditTrail
 *
 * Paginated, filterable view of the system audit log. Filters by entity type,
 * action, and actor type. Backend uses offset/limit pagination and returns
 * `{ logs, pagination: { total, limit, offset } }`.
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
  CFormSelect,
  CModal,
  CModalBody,
  CModalHeader,
  CModalTitle,
  CPagination,
  CPaginationItem,
  CRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilReload } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import { useAuditLogs } from '../../hooks/useAudits'
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AuditTrail = () => {
  const [entityType, setEntityType] = useState('')
  const [action, setAction] = useState('')
  const [actorType, setActorType] = useState('')
  const [page, setPage] = useState(1)
  const [jsonEntry, setJsonEntry] = useState(null)

  const offset = (page - 1) * PAGE_SIZE
  const params = { entityType, action, actorType, limit: PAGE_SIZE, offset }
  const { data, isLoading, error, refetch, isFetching } = useAuditLogs(params)

  const logs = data?.logs ?? []
  const total = data?.pagination?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const resetPageAnd = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

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
                <span title={`ID ${r.actor_id}`}>{name}</span>
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
            <CCol md={4}>
              <CFormInput
                placeholder="Entity type (e.g. LOAN, CLIENT)"
                value={entityType}
                onChange={(e) => resetPageAnd(setEntityType)(e.target.value)}
              />
            </CCol>
            <CCol md={4}>
              <CFormSelect value={action} onChange={(e) => resetPageAnd(setAction)(e.target.value)}>
                <option value="">All actions</option>
                {AUDIT_ACTION.values.map((v) => (
                  <option key={v} value={v}>
                    {AUDIT_ACTION.labels[v]}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={4}>
              <CFormSelect value={actorType} onChange={(e) => resetPageAnd(setActorType)(e.target.value)}>
                <option value="">All actor types</option>
                {ACTOR_TYPE.values.map((v) => (
                  <option key={v} value={v}>
                    {ACTOR_TYPE.labels[v]}
                  </option>
                ))}
              </CFormSelect>
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

          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <span className="small text-body-secondary">
                {total} entries · page {page} of {totalPages}
              </span>
              <CPagination className="mb-0">
                <CPaginationItem disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </CPaginationItem>
                <CPaginationItem disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </CPaginationItem>
              </CPagination>
            </div>
          )}
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
