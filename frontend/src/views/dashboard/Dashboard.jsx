/**
 * Dashboard
 *
 * Main admin dashboard: KPI cards, loan-status doughnut, portfolio aging bar,
 * monthly disbursements vs collections line chart, income vs expenditure
 * composite bar chart, and a recent activity table.
 *
 * @module views/dashboard/Dashboard
 */

import React from 'react'
import { Link } from 'react-router-dom'
import {
  CBadge,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { CChartBar, CChartDoughnut, CChartLine } from '@coreui/react-chartjs'

import { useDashboardStats } from '../../hooks/useReports'
import { useAuditLogs } from '../../hooks/useAudits'
import { AUDIT_ACTION, LOAN_STATUS } from '../../constants/enums'
import { formatCurrency, formatDateTime } from '../../utils/format'

// Aging bucket colours: green (current) → dark red (most overdue)
const BUCKET_COLORS = ['#2eb85c', '#f9b115', '#f86c3b', '#e55353', '#8a1c1c']

// Map CoreUI badge colour names → Chart.js rgba values
const BADGE_TO_RGBA = {
  success:   'rgba(46,184,92,0.8)',
  danger:    'rgba(229,83,83,0.8)',
  warning:   'rgba(249,177,21,0.8)',
  primary:   'rgba(50,31,219,0.8)',
  info:      'rgba(51,153,255,0.8)',
  secondary: 'rgba(157,165,177,0.8)',
  dark:      'rgba(79,93,115,0.8)',
  light:     'rgba(235,237,239,0.9)',
}

// ── KPI card ─────────────────────────────────────────────────────────────────────────────────

const KpiCard = ({ title, value, sub, color = 'primary' }) => (
  <CCard
    className='mb-0 h-100'
    style={{ borderLeft: `4px solid var(--cui-${color})` }}
  >
    <CCardBody className='py-3 px-3'>
      <div className='text-body-secondary small fw-semibold text-uppercase mb-1'>{title}</div>
      <div className='fs-4 fw-bold'>{value}</div>
      {sub && <div className='text-body-secondary small mt-1'>{sub}</div>}
    </CCardBody>
  </CCard>
)

// ── Loading placeholder ────────────────────────────────────────────────────────────────

const ChartLoader = () => (
  <div className='d-flex align-items-center justify-content-center' style={{ minHeight: 260 }}>
    <CSpinner color='secondary' />
  </div>
)

// ── Dashboard ─────────────────────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const { data, isLoading, error } = useDashboardStats()
  const { data: auditData, isLoading: auditLoading } = useAuditLogs({ limit: 10 })

  const kpis         = data?.kpis
  const breakdown    = data?.loanStatusBreakdown ?? []
  const trends       = data?.monthlyTrends ?? []
  const financials   = data?.monthlyFinancials ?? []
  const agingBuckets = data?.portfolioAging?.buckets ?? []
  const recentLogs   = auditData?.logs ?? []

  // ── Chart datasets ───────────────────────────────────────────────────────────────

  const doughnutData = {
    labels: breakdown.map((b) => LOAN_STATUS.labels[b.status] ?? b.status),
    datasets: [{
      data: breakdown.map((b) => b.count),
      backgroundColor: breakdown.map(
        (b) => BADGE_TO_RGBA[LOAN_STATUS.colors[b.status]] ?? BADGE_TO_RGBA.secondary,
      ),
      borderWidth: 1,
    }],
  }

  const lineData = {
    labels: trends.map((t) => t.month),
    datasets: [
      {
        label: 'Disbursed',
        backgroundColor: 'rgba(50,31,219,0.08)',
        borderColor: 'rgba(50,31,219,0.9)',
        pointBackgroundColor: 'rgba(50,31,219,0.9)',
        data: trends.map((t) => t.disbursed),
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Collected',
        backgroundColor: 'rgba(46,184,92,0.08)',
        borderColor: 'rgba(46,184,92,0.9)',
        pointBackgroundColor: 'rgba(46,184,92,0.9)',
        data: trends.map((t) => t.collected),
        fill: true,
        tension: 0.3,
      },
    ],
  }

  const financialData = {
    labels: financials.map((f) => f.month),
    datasets: [
      {
        label: 'Income',
        backgroundColor: 'rgba(46,184,92,0.8)',
        data: financials.map((f) => f.income),
      },
      {
        label: 'Expenditure',
        backgroundColor: 'rgba(229,83,83,0.8)',
        data: financials.map((f) => f.expenditure),
      },
    ],
  }

  const agingBarData = {
    labels: agingBuckets.map((b) => b.label),
    datasets: [{
      label: 'Principal Outstanding',
      backgroundColor: agingBuckets.map((_, i) => BUCKET_COLORS[i] ?? '#636f83'),
      data: agingBuckets.map((b) => b.principalOutstanding),
    }],
  }

  const sharedChartOptions = {
    plugins: { legend: { position: 'top' } },
    scales: { y: { beginAtZero: true } },
  }

  // ── Error state ───────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className='text-center py-5 text-danger'>
        Failed to load dashboard data. {error.message}
      </div>
    )
  }

  return (
    <>
      {/* Row 1: KPI cards */}
      <CRow className='g-3 mb-4'>
        <CCol sm={6} xl={4} xxl={2}>
          {isLoading
            ? <KpiCard title='Active Portfolio' value={<CSpinner size='sm' />} color='primary' />
            : <KpiCard
                title='Active Portfolio'
                value={formatCurrency(kpis?.activePortfolio?.totalPrincipal)}
                sub={`${kpis?.activePortfolio?.count ?? 0} active loans`}
                color='primary'
              />}
        </CCol>
        <CCol sm={6} xl={4} xxl={2}>
          {isLoading
            ? <KpiCard title='Overdue Loans' value={<CSpinner size='sm' />} color='danger' />
            : <KpiCard
                title='Overdue Loans'
                value={String(kpis?.overdueLoans?.count ?? 0)}
                sub={formatCurrency(kpis?.overdueLoans?.totalOutstanding)}
                color='danger'
              />}
        </CCol>
        <CCol sm={6} xl={4} xxl={2}>
          {isLoading
            ? <KpiCard title='Pending Approvals' value={<CSpinner size='sm' />} color='warning' />
            : <KpiCard
                title='Pending Approvals'
                value={String(kpis?.pendingApprovals?.count ?? 0)}
                sub='awaiting review'
                color='warning'
              />}
        </CCol>
        <CCol sm={6} xl={4} xxl={2}>
          {isLoading
            ? <KpiCard title='KYC Queue' value={<CSpinner size='sm' />} color='info' />
            : <KpiCard
                title='KYC Queue'
                value={String(kpis?.kycQueue?.count ?? 0)}
                sub='pending KYC review'
                color='info'
              />}
        </CCol>
        <CCol sm={6} xl={4} xxl={2}>
          {isLoading
            ? <KpiCard title='Payments This Month' value={<CSpinner size='sm' />} color='success' />
            : <KpiCard
                title='Payments This Month'
                value={formatCurrency(kpis?.paymentsThisMonth?.total)}
                sub={`${kpis?.paymentsThisMonth?.count ?? 0} transactions`}
                color='success'
              />}
        </CCol>
        <CCol sm={6} xl={4} xxl={2}>
          {isLoading
            ? <KpiCard title='Member Savings (Net)' value={<CSpinner size='sm' />} color='dark' />
            : <KpiCard
                title='Member Savings (Net)'
                value={formatCurrency(kpis?.memberSavingsNet?.netBalance)}
                color='dark'
              />}
        </CCol>
      </CRow>

      {/* Row 2: Loan status doughnut + Portfolio aging bar */}
      <CRow className='g-3 mb-4'>
        <CCol md={5}>
          <CCard className='h-100'>
            <CCardHeader><strong>Loan Status Breakdown</strong></CCardHeader>
            <CCardBody className='d-flex align-items-center justify-content-center'>
              {isLoading
                ? <ChartLoader />
                : breakdown.length === 0
                  ? <p className='text-body-secondary my-5'>No loan data.</p>
                  : <CChartDoughnut
                      data={doughnutData}
                      options={{ plugins: { legend: { position: 'right' } }, cutout: '60%' }}
                      style={{ maxHeight: 300 }}
                    />}
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={7}>
          <CCard className='h-100'>
            <CCardHeader><strong>Portfolio Aging (Today)</strong></CCardHeader>
            <CCardBody>
              {isLoading
                ? <ChartLoader />
                : agingBuckets.length === 0
                  ? <p className='text-body-secondary my-5'>No outstanding installments.</p>
                  : <CChartBar
                      data={agingBarData}
                      options={{
                        plugins: { legend: { display: false } },
                        scales: { y: { beginAtZero: true } },
                      }}
                      style={{ maxHeight: 300 }}
                    />}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Row 3: Monthly trends line + Income vs Expenditure composite bar */}
      <CRow className='g-3 mb-4'>
        <CCol md={6}>
          <CCard className='h-100'>
            <CCardHeader><strong>Monthly Disbursements vs Collections</strong></CCardHeader>
            <CCardBody>
              {isLoading
                ? <ChartLoader />
                : <CChartLine data={lineData} options={sharedChartOptions} style={{ maxHeight: 260 }} />}
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={6}>
          <CCard className='h-100'>
            <CCardHeader><strong>Income vs Expenditure (Last 6 Months)</strong></CCardHeader>
            <CCardBody>
              {isLoading
                ? <ChartLoader />
                : <CChartBar data={financialData} options={sharedChartOptions} style={{ maxHeight: 260 }} />}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Row 4: Recent activity */}
      <CRow className='mb-4'>
        <CCol>
          <CCard>
            <CCardHeader className='d-flex justify-content-between align-items-center'>
              <strong>Recent Activity</strong>
              <Link to='/reports/audit-trail' className='text-decoration-none small'>
                View full audit trail →
              </Link>
            </CCardHeader>
            <CCardBody className='p-0'>
              {auditLoading
                ? <div className='text-center py-4'><CSpinner color='secondary' /></div>
                : <CTable hover responsive align='middle' className='mb-0'>
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>Entity</CTableHeaderCell>
                        <CTableHeaderCell>Action</CTableHeaderCell>
                        <CTableHeaderCell>Actor</CTableHeaderCell>
                        <CTableHeaderCell className='text-nowrap'>When</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {recentLogs.length === 0 && (
                        <CTableRow>
                          <CTableDataCell colSpan={4} className='text-center text-body-secondary py-4'>
                            No recent activity.
                          </CTableDataCell>
                        </CTableRow>
                      )}
                      {recentLogs.map((log) => (
                        <CTableRow key={log.audit_id}>
                          <CTableDataCell>
                            <CBadge color='secondary' className='me-1'>{log.entity_type}</CBadge>
                            <span className='text-body-secondary small'>#{log.entity_id}</span>
                          </CTableDataCell>
                          <CTableDataCell>
                            <CBadge color={AUDIT_ACTION.colors[log.action] ?? 'secondary'}>
                              {AUDIT_ACTION.labels[log.action] ?? log.action}
                            </CBadge>
                          </CTableDataCell>
                          <CTableDataCell className='small'>
                            {log.actor_type === 'SYSTEM' || log.actor_type === 'SERVICE'
                              ? (log.actor_type === 'SYSTEM' ? 'System' : 'Service')
                              : log.actor
                                ? [log.actor.first_name, log.actor.last_name].filter(Boolean).join(' ')
                                : `#${log.actor_id}`}
                          </CTableDataCell>
                          <CTableDataCell className='small text-body-secondary text-nowrap'>
                            {formatDateTime(log.occurred_at)}
                          </CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  )
}

export default Dashboard
