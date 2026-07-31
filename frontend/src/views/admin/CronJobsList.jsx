/**
 * CronJobsList
 *
 * Admin view for scheduled background jobs. Shows each registered cron job,
 * its schedule/timezone, and the outcome of its last run, and lets admins
 * trigger a manual run on demand (with a confirmation prompt) and inspect
 * recent run history.
 *
 * Read: admin + manager (role 1, 2). Manual run: admin only (role 1).
 *
 * @module views/admin/CronJobsList
 */

import React, { useState } from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilHistory, cilMediaPlay, cilReload } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ConfirmModal from '../../components/ConfirmModal'
import { useCronJobs, useCronJobRuns, useRunCronJob } from '../../hooks/useCronJobs'
import { useAuth } from '../../context/AuthContext'
import { formatDateTime } from '../../utils/format'

const RUN_STATUS_ENUM = {
  colors: { success: 'success', failed: 'danger', running: 'info' },
  labels: { success: 'Success', failed: 'Failed', running: 'Running' },
}

const formatDuration = (ms) => {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms} ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)} s`
  const m = Math.floor(s / 60)
  return `${m}m ${Math.round(s % 60)}s`
}

const LastRunCell = ({ lastRun }) => {
  if (!lastRun) return <span className="text-body-secondary">Never run</span>
  return (
    <div className="d-flex flex-column">
      <StatusBadge enumDef={RUN_STATUS_ENUM} value={lastRun.status} />
      <span className="text-body-secondary small mt-1">{formatDateTime(lastRun.finishedAt || lastRun.startedAt)}</span>
    </div>
  )
}

/** Render a run summary/error compactly as key: value pairs. */
const SummaryView = ({ run }) => {
  if (!run) return <span className="text-body-secondary">—</span>
  if (run.status === 'failed') return <span className="text-danger">{run.error || 'Failed'}</span>
  const summary = run.summary
  if (!summary || typeof summary !== 'object') return <span className="text-body-secondary">—</span>
  return (
    <div className="d-flex flex-wrap gap-2">
      {Object.entries(summary).map(([k, v]) => (
        <span key={k} className="badge bg-light text-dark border">
          {k}: <strong className="ms-1">{String(v)}</strong>
        </span>
      ))}
    </div>
  )
}

/** Modal listing recent run history for a single job. */
const RunHistoryModal = ({ job, onClose }) => {
  const { data: runs = [], isLoading, error } = useCronJobRuns(job?.key, { enabled: Boolean(job) })

  const columns = [
    { key: 'startedAt', label: 'Started', render: (r) => formatDateTime(r.startedAt) },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge enumDef={RUN_STATUS_ENUM} value={r.status} />,
    },
    { key: 'durationMs', label: 'Duration', render: (r) => formatDuration(r.durationMs) },
    {
      key: 'triggeredBy',
      label: 'Trigger',
      render: (r) => (r.triggeredBy === 'USER' ? r.triggeredByName || 'Manual' : 'Scheduler'),
    },
    { key: 'summary', label: 'Result', render: (r) => <SummaryView run={r} /> },
  ]

  return (
    <CModal visible={Boolean(job)} onClose={onClose} alignment="center" size="xl" scrollable>
      <CModalHeader>
        <CModalTitle>Run History — {job?.name}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <DataTable
          columns={columns}
          rows={runs}
          loading={isLoading}
          error={error}
          emptyMessage="No runs recorded yet."
          rowKey={(r) => r.id}
        />
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" onClick={onClose}>
          Close
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

const CronJobsList = () => {
  const { role } = useAuth()
  const isAdmin = role === 1

  const { data: jobs = [], isLoading, error, refetch, isFetching } = useCronJobs()
  const runMutation = useRunCronJob()

  const [toRun, setToRun] = useState(null)
  const [historyJob, setHistoryJob] = useState(null)
  const [runError, setRunError] = useState('')

  const confirmRun = async () => {
    setRunError('')
    try {
      await runMutation.mutateAsync(toRun.key)
      setToRun(null)
    } catch (err) {
      setRunError(err?.data?.message || err?.message || 'Failed to run job')
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Job',
      render: (row) => (
        <div className="d-flex flex-column">
          <span className="fw-semibold">{row.name}</span>
          {row.description && <span className="text-body-secondary small">{row.description}</span>}
        </div>
      ),
    },
    {
      key: 'schedule',
      label: 'Schedule',
      render: (row) => (
        <div className="d-flex flex-column">
          <span>{row.scheduleLabel || row.schedule}</span>
          <span className="text-body-secondary small">
            <code>{row.schedule}</code>
            {row.timezone ? ` · ${row.timezone}` : ''}
          </span>
        </div>
      ),
    },
    { key: 'lastRun', label: 'Last Run', render: (row) => <LastRunCell lastRun={row.lastRun} /> },
    {
      key: 'lastResult',
      label: 'Last Result',
      render: (row) => <SummaryView run={row.lastRun} />,
    },
    {
      key: 'actions',
      label: '',
      className: 'text-end',
      render: (row) => (
        <div className="d-flex gap-2 justify-content-end">
          <CButton
            color="light"
            size="sm"
            className="d-inline-flex align-items-center text-nowrap"
            title="Run history"
            onClick={() => setHistoryJob(row)}
          >
            <CIcon icon={cilHistory} className="me-1" />
            History
          </CButton>
          {isAdmin && (
            <CButton
              color="primary"
              size="sm"
              className="d-inline-flex align-items-center text-nowrap"
              disabled={row.isRunning || (runMutation.isPending && toRun?.key === row.key)}
              title={row.isRunning ? 'Job is running' : 'Run now'}
              onClick={() => {
                setRunError('')
                setToRun(row)
              }}
            >
              {row.isRunning ? (
                <>
                  <CSpinner size="sm" className="me-1" />
                  Running
                </>
              ) : (
                <>
                  <CIcon icon={cilMediaPlay} className="me-1" />
                  Run now
                </>
              )}
            </CButton>
          )}
        </div>
      ),
    },
  ]

  return (
    <CRow>
      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader className="d-flex justify-content-between align-items-center">
            <strong>Scheduled Jobs</strong>
            <CButton color="light" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <CIcon icon={cilReload} className="me-1" />
              Refresh
            </CButton>
          </CCardHeader>
          <CCardBody>
            <DataTable
              columns={columns}
              rows={jobs}
              loading={isLoading}
              error={error}
              emptyMessage="No cron jobs registered."
              rowKey={(r) => r.key}
            />
          </CCardBody>
        </CCard>
      </CCol>

      <ConfirmModal
        visible={Boolean(toRun)}
        title="Run job now?"
        confirmText="Run now"
        confirmColor="primary"
        loading={runMutation.isPending}
        onClose={() => setToRun(null)}
        onConfirm={confirmRun}
        body={
          <>
            <p>
              Trigger <strong>{toRun?.name}</strong> immediately? This runs the same work as the
              scheduled job and is safe to run at any time.
            </p>
            {runError && <div className="text-danger small">{runError}</div>}
          </>
        }
      />

      <RunHistoryModal job={historyJob} onClose={() => setHistoryJob(null)} />
    </CRow>
  )
}

export default CronJobsList
