/**
 * Layout for the client self-service portal. Mirrors DefaultLayout but with
 * the client nav, a client header, and nested routes rendered via <Outlet/>
 * (routes are declared in App.jsx from portalRoutes.js).
 *
 * @component
 */

import React, { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { CContainer, CSpinner } from '@coreui/react'

import AppSidebar from '../components/AppSidebar'
import AppFooter from '../components/AppFooter'
import ClientHeader from './ClientHeader'
import portalNav from '../_portalNav'

const ClientLayout = () => (
  <div>
    <AppSidebar items={portalNav} brandTo="/portal/dashboard" />
    <div className="wrapper app-shell-bg d-flex flex-column min-vh-100">
      <ClientHeader />
      <div className="body flex-grow-1">
        <CContainer className="px-3 px-md-4" lg>
          <Suspense fallback={<CSpinner color="primary" />}>
            <Outlet />
          </Suspense>
        </CContainer>
      </div>
      <AppFooter />
    </div>
  </div>
)

export default ClientLayout
