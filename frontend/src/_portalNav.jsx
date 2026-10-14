/**
 * Sidebar navigation for the client self-service portal.
 *
 * Everything here is scoped server-side to the logged-in client, so — unlike
 * the staff `_nav` — items carry no `permission` keys.
 *
 * @module _portalNav
 */

import React from 'react'
import CIcon from '@coreui/icons-react'
import { cilSpeedometer, cilMoney, cilPlus, cilWallet, cilTask, cilUser } from '@coreui/icons'
import { CNavItem, CNavTitle } from '@coreui/react'

const _portalNav = [
  {
    component: CNavItem,
    name: 'Dashboard',
    to: '/portal/dashboard',
    icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
  },
  { component: CNavTitle, name: 'Loans' },
  {
    component: CNavItem,
    name: 'My Loans',
    to: '/portal/loans',
    icon: <CIcon icon={cilMoney} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Apply for a Loan',
    to: '/portal/apply',
    icon: <CIcon icon={cilPlus} customClassName="nav-icon" />,
  },
  { component: CNavTitle, name: 'Payments' },
  {
    component: CNavItem,
    name: 'My Payments',
    to: '/portal/payments',
    icon: <CIcon icon={cilWallet} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Report a Payment',
    to: '/portal/report-payment',
    icon: <CIcon icon={cilTask} customClassName="nav-icon" />,
  },
  { component: CNavTitle, name: 'Account' },
  {
    component: CNavItem,
    name: 'My Profile',
    to: '/portal/profile',
    icon: <CIcon icon={cilUser} customClassName="nav-icon" />,
  },
]

export default _portalNav
