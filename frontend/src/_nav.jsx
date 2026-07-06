/**
 * Sidebar Navigation Configuration — ARIS LMS Admin Portal
 *
 * Defines the sidebar menu structure mapped to the backend LMS modules.
 * Component types:
 * - CNavItem: single link
 * - CNavGroup: collapsible group
 * - CNavTitle: section heading
 *
 * @module _nav
 */

import React from 'react'
import CIcon from '@coreui/icons-react'
import {
  cilSpeedometer,
  cilPeople,
  cilMoney,
  cilLayers,
  cilCreditCard,
  cilShieldAlt,
  cilWallet,
  cilCalculator,
  cilChartLine,
  cilHistory,
  cilUser,
  cilLockLocked,
  cilBell,
  cilSettings,
} from '@coreui/icons'
import { CNavGroup, CNavItem, CNavTitle } from '@coreui/react'

const _nav = [
  {
    component: CNavItem,
    name: 'Dashboard',
    to: '/dashboard',
    icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
  },
  {
    component: CNavTitle,
    name: 'Lending',
  },
  {
    component: CNavItem,
    name: 'Clients',
    to: '/clients',
    icon: <CIcon icon={cilPeople} customClassName="nav-icon" />,
  },
  {
    component: CNavGroup,
    name: 'Loans',
    icon: <CIcon icon={cilMoney} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'All Loans',
        to: '/loans',
      },
      {
        component: CNavItem,
        name: 'Approval Queue',
        to: '/loans/approvals',
      },
    ],
  },
  {
    component: CNavItem,
    name: 'Loan Products',
    to: '/loan-products',
    icon: <CIcon icon={cilLayers} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Payments',
    to: '/payments',
    icon: <CIcon icon={cilCreditCard} customClassName="nav-icon" />,
  },
  // {
  //   component: CNavItem,
  //   name: 'Collaterals',
  //   to: '/collaterals',
  //   icon: <CIcon icon={cilShieldAlt} customClassName="nav-icon" />,
  // },
  {
    component: CNavItem,
    name: 'Member Contributions',
    to: '/member-contributions',
    icon: <CIcon icon={cilWallet} customClassName="nav-icon" />,
  },
  {
    component: CNavTitle,
    name: 'Accounting',
  },
  {
    component: CNavGroup,
    name: 'Accounting',
    icon: <CIcon icon={cilCalculator} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'Chart of Accounts',
        to: '/accounting/chart-of-accounts',
      },
      {
        component: CNavItem,
        name: 'Journal Entries',
        to: '/accounting/ledger',
      },
      {
        component: CNavItem,
        name: 'Trial Balance',
        to: '/accounting/trial-balance',
      },
    ],
  },
  {
    component: CNavTitle,
    name: 'Reports',
  },
  {
    component: CNavItem,
    name: 'Portfolio Aging',
    to: '/reports/portfolio-aging',
    icon: <CIcon icon={cilChartLine} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Audit Trail',
    to: '/reports/audit-trail',
    icon: <CIcon icon={cilHistory} customClassName="nav-icon" />,
  },
  {
    component: CNavTitle,
    name: 'Administration',
  },
  {
    component: CNavItem,
    name: 'Users',
    to: '/admin/users',
    icon: <CIcon icon={cilUser} customClassName="nav-icon" />,
    roles: [1, 2],
  },
  {
    component: CNavItem,
    name: 'Roles & Permissions',
    to: '/admin/roles',
    icon: <CIcon icon={cilLockLocked} customClassName="nav-icon" />,
    roles: [1, 2],
  },
  {
    component: CNavItem,
    name: 'System Configuration',
    to: '/settings/system-config',
    icon: <CIcon icon={cilSettings} customClassName="nav-icon" />,
    roles: [1],
  },
  {
    component: CNavItem,
    name: 'Notifications',
    to: '/notifications',
    icon: <CIcon icon={cilBell} customClassName="nav-icon" />,
  },
]

export default _nav
