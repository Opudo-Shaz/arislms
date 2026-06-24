/**
 * Application Routes Configuration — ARIS LMS Admin Portal
 *
 * Protected routes rendered inside `DefaultLayout` via `AppContent`.
 * Each entry: { path, name, element, [exact] }.
 *
 * All LMS modules are implemented (see FRONTEND_PORTAL_PLAN.md build phases).
 *
 * @module routes
 */

import React from 'react'

// Implemented
const Dashboard = React.lazy(() => import('./views/dashboard/Dashboard'))
const ClientsList = React.lazy(() => import('./views/clients/ClientsList'))
const ClientForm = React.lazy(() => import('./views/clients/ClientForm'))
const ClientDetail = React.lazy(() => import('./views/clients/ClientDetail'))
const LoanProductsList = React.lazy(() => import('./views/loanProducts/LoanProductsList'))
const LoansList = React.lazy(() => import('./views/loans/LoansList'))
const LoanDetail = React.lazy(() => import('./views/loans/LoanDetail'))
const LoanApplicationForm = React.lazy(() => import('./views/loans/LoanApplicationForm'))
const LoanApprovals = React.lazy(() => import('./views/loans/LoanApprovals'))
const PaymentsList = React.lazy(() => import('./views/payments/PaymentsList'))
const CollateralsList = React.lazy(() => import('./views/collaterals/CollateralsList'))
const ChartOfAccountsList = React.lazy(() => import('./views/accounting/ChartOfAccountsList'))
const JournalEntriesList = React.lazy(() => import('./views/accounting/JournalEntriesList'))
const TrialBalance = React.lazy(() => import('./views/accounting/TrialBalance'))
const MemberContributionsList = React.lazy(
  () => import('./views/memberContributions/MemberContributionsList'),
)
const UsersList = React.lazy(() => import('./views/admin/UsersList'))
const RolesList = React.lazy(() => import('./views/admin/RolesList'))
const NotificationsList = React.lazy(() => import('./views/notifications/NotificationsList'))
const AuditTrail = React.lazy(() => import('./views/reports/AuditTrail'))
const PortfolioAging = React.lazy(() => import('./views/reports/PortfolioAging'))
const UserProfile = React.lazy(() => import('./views/profile/UserProfile'))

export const routes = [
  { path: '/', exact: true, name: 'Home' },
  { path: '/dashboard', name: 'Dashboard', element: Dashboard },

  // Clients (Phase 1)
  { path: '/clients', name: 'Clients', element: ClientsList, exact: true },
  { path: '/clients/new', name: 'New Client', element: ClientForm },
  { path: '/clients/:id', name: 'Client Detail', element: ClientDetail, exact: true },
  { path: '/clients/:id/edit', name: 'Edit Client', element: ClientForm },

  // Loans (Phase 2)
  { path: '/loans', name: 'Loans', element: LoansList, exact: true },
  { path: '/loans/approvals', name: 'Approval Queue', element: LoanApprovals },
  { path: '/loans/new', name: 'New Application', element: LoanApplicationForm },
  { path: '/loans/:id', name: 'Loan Detail', element: LoanDetail, exact: true },

  // Loan Products (Phase 1)
  {
    path: '/loan-products',
    name: 'Loan Products',
    element: LoanProductsList,
  },

  // Payments & Collaterals (Phase 3)
  { path: '/payments', name: 'Payments', element: PaymentsList },
  { path: '/collaterals', name: 'Collaterals', element: CollateralsList },

  // Member Contributions (Phase 4)
  {
    path: '/member-contributions',
    name: 'Member Contributions',
    element: MemberContributionsList,
  },

  // Accounting (Phase 4)
  {
    path: '/accounting/chart-of-accounts',
    name: 'Chart of Accounts',
    element: ChartOfAccountsList,
  },
  {
    path: '/accounting/ledger',
    name: 'Journal Entries',
    element: JournalEntriesList,
  },
  {
    path: '/accounting/trial-balance',
    name: 'Trial Balance',
    element: TrialBalance,
  },

  // Reports (Phase 5)
  {
    path: '/reports/portfolio-aging',
    name: 'Portfolio Aging',
    element: PortfolioAging,
  },
  {
    path: '/reports/audit-trail',
    name: 'Audit Trail',
    element: AuditTrail,
  },

  // Administration (Phase 5)
  { path: '/admin/users', name: 'Users', element: UsersList },
  {
    path: '/admin/roles',
    name: 'Roles & Permissions',
    element: RolesList,
  },

  // Notifications (Phase 5)
  {
    path: '/notifications',
    name: 'Notifications',
    element: NotificationsList,
  },

  // User profile
  { path: '/profile', name: 'My Profile', element: UserProfile },
]

export default routes
