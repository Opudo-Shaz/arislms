/**
 * Client self-service portal routes, rendered inside `ClientLayout` under
 * `/portal` (see App.jsx). Same `{ path, name, element }` shape as routes.js
 * so AppBreadcrumb can resolve names from either table.
 *
 * @module portalRoutes
 */

import React from 'react'

const PortalDashboard = React.lazy(() => import('./views/portal/PortalDashboard'))
const MyLoans = React.lazy(() => import('./views/portal/MyLoans'))
const MyLoanDetail = React.lazy(() => import('./views/portal/MyLoanDetail'))
const LoanRequestForm = React.lazy(() => import('./views/portal/LoanRequestForm'))
const MyPayments = React.lazy(() => import('./views/portal/MyPayments'))
const ReportPaymentForm = React.lazy(() => import('./views/portal/ReportPaymentForm'))
const MyProfile = React.lazy(() => import('./views/portal/MyProfile'))

export const portalRoutes = [
  { path: '/portal/dashboard', name: 'Dashboard', element: PortalDashboard },
  { path: '/portal/loans', name: 'My Loans', element: MyLoans },
  { path: '/portal/loans/:id', name: 'Loan Detail', element: MyLoanDetail },
  { path: '/portal/apply', name: 'Apply for a Loan', element: LoanRequestForm },
  { path: '/portal/payments', name: 'My Payments', element: MyPayments },
  { path: '/portal/report-payment', name: 'Report a Payment', element: ReportPaymentForm },
  { path: '/portal/profile', name: 'My Profile', element: MyProfile },
]

export default portalRoutes
