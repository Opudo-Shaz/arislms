/**
 * Application Routes Configuration — ARIS LMS Admin Portal
 *
 * Protected routes rendered inside `DefaultLayout` via `AppContent`.
 * Each entry: { path, name, element, [exact] }.
 *
 * Modules not yet implemented use `ModulePlaceholder` and are replaced with
 * real screens in their respective build phases (see FRONTEND_PORTAL_PLAN.md).
 *
 * @module routes
 */

import React from 'react'
import ModulePlaceholder from './views/ModulePlaceholder'

// Implemented
const Dashboard = React.lazy(() => import('./views/dashboard/Dashboard'))

/**
 * Factory for a phase placeholder route element.
 * @param {string} title
 * @param {string} phase
 * @returns {() => JSX.Element}
 */
const placeholder =
  (title, phase) =>
  // eslint-disable-next-line react/display-name
  () =>
    React.createElement(ModulePlaceholder, { title, phase })

export const routes = [
  { path: '/', exact: true, name: 'Home' },
  { path: '/dashboard', name: 'Dashboard', element: Dashboard },

  // Clients (Phase 1)
  { path: '/clients', name: 'Clients', element: placeholder('Clients', 'Phase 1') },

  // Loans (Phase 2)
  { path: '/loans', name: 'Loans', element: placeholder('Loans', 'Phase 2'), exact: true },
  {
    path: '/loans/approvals',
    name: 'Approval Queue',
    element: placeholder('Loan Approval Queue', 'Phase 2'),
  },
  {
    path: '/loans/new',
    name: 'New Application',
    element: placeholder('New Loan Application', 'Phase 2'),
  },

  // Loan Products (Phase 1)
  {
    path: '/loan-products',
    name: 'Loan Products',
    element: placeholder('Loan Products', 'Phase 1'),
  },

  // Payments & Collaterals (Phase 3)
  { path: '/payments', name: 'Payments', element: placeholder('Payments', 'Phase 3') },
  { path: '/collaterals', name: 'Collaterals', element: placeholder('Collaterals', 'Phase 3') },

  // Member Contributions (Phase 4)
  {
    path: '/member-contributions',
    name: 'Member Contributions',
    element: placeholder('Member Contributions', 'Phase 4'),
  },

  // Accounting (Phase 4)
  {
    path: '/accounting/chart-of-accounts',
    name: 'Chart of Accounts',
    element: placeholder('Chart of Accounts', 'Phase 4'),
  },
  {
    path: '/accounting/ledger',
    name: 'Journal Entries',
    element: placeholder('Journal Entries (Ledger)', 'Phase 4'),
  },
  {
    path: '/accounting/trial-balance',
    name: 'Trial Balance',
    element: placeholder('Trial Balance', 'Phase 4'),
  },

  // Reports (Phase 5)
  {
    path: '/reports/portfolio-aging',
    name: 'Portfolio Aging',
    element: placeholder('Portfolio Aging', 'Phase 5'),
  },
  {
    path: '/reports/audit-trail',
    name: 'Audit Trail',
    element: placeholder('Audit Trail', 'Phase 5'),
  },

  // Administration (Phase 5)
  { path: '/admin/users', name: 'Users', element: placeholder('Users', 'Phase 5') },
  {
    path: '/admin/roles',
    name: 'Roles & Permissions',
    element: placeholder('Roles & Permissions', 'Phase 5'),
  },

  // Notifications (Phase 5)
  {
    path: '/notifications',
    name: 'Notifications',
    element: placeholder('Notifications', 'Phase 5'),
  },
]

export default routes
