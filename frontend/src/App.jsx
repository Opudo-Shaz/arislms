/**
 * App Component
 *
 * Root application component that sets up routing, theme management,
 * and lazy-loaded page components with suspense boundaries.
 *
 * Features:
 * - Client-side routing with BrowserRouter
 * - Theme detection from URL parameters and Redux state
 * - Lazy loading for all routes with loading spinner fallback
 * - Public routes (home, login, register, error pages)
 * - Client self-service portal under /portal (ClientLayout, client session)
 * - Protected staff routes wrapped in DefaultLayout
 *
 * @module App
 */

import React, { Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useSelector } from 'react-redux'

import { CSpinner, useColorModes } from '@coreui/react'
import './scss/style.scss'

// We use those styles to show code examples, you should remove them in your application.
import './scss/examples.scss'

import { portalRoutes } from './portalRoutes'

// Containers
const DefaultLayout = React.lazy(() => import('./layout/DefaultLayout'))
const RequireAuth = React.lazy(() => import('./components/RequireAuth'))
const RequireClientAuth = React.lazy(() => import('./components/RequireClientAuth'))
const ClientLayout = React.lazy(() => import('./layout/ClientLayout'))

// Pages
const Login = React.lazy(() => import('./views/pages/login/Login'))
const Register = React.lazy(() => import('./views/pages/register/Register'))
const Page404 = React.lazy(() => import('./views/pages/page404/Page404'))
const Page500 = React.lazy(() => import('./views/pages/page500/Page500'))
const Unauthorized = React.lazy(() => import('./views/pages/unauthorized/Unauthorized'))
const ResetPassword = React.lazy(() => import('./views/pages/resetPassword/ResetPassword'))
const AcceptInvite = React.lazy(() => import('./views/pages/acceptInvite/AcceptInvite'))
const ClientRegistration = React.lazy(() => import('./views/pages/clientRegistration/ClientRegistration'))
const Home = React.lazy(() => import('./views/home/Home'))
const PortalLogin = React.lazy(() => import('./views/portal/PortalLogin'))
const CoSignerConsent = React.lazy(() => import('./views/portal/CoSignerConsent'))

/**
 * Main Application Component
 *
 * Manages application-wide concerns:
 * - Theme initialization and persistence
 * - Client-side routing configuration
 * - Lazy loading with suspense fallbacks
 * - Theme detection from URL query parameters
 *
 * Theme priority:
 * 1. URL parameter (?theme=dark)
 * 2. Redux stored theme
 * 3. Browser/system preference (auto)
 *
 * @component
 * @returns {React.ReactElement} Application root with routing
 *
 * @example
 * // Standard usage in index.js
 * import App from './App'
 * ReactDOM.render(<App />, document.getElementById('root'))
 */
const App = () => {
  const { isColorModeSet, setColorMode } = useColorModes('coreui-free-react-admin-template-theme')
  const storedTheme = useSelector((state) => state.theme)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.href.split('?')[1])
    const theme = urlParams.get('theme') && urlParams.get('theme').match(/^[A-Za-z0-9\s]+/)[0]
    if (theme) {
      setColorMode(theme)
    }

    if (isColorModeSet()) {
      return
    }

    setColorMode(storedTheme)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="pt-3 text-center">
            <CSpinner color="primary" variant="grow" />
          </div>
        }
      >
        <Routes>
          <Route exact path="/" name="Home" element={<Home />} />
          <Route exact path="/login" name="Login Page" element={<Login />} />
          <Route exact path="/register" name="Register Page" element={<Register />} />
          <Route exact path="/reset-password" name="Reset Password" element={<ResetPassword />} />
          <Route exact path="/accept-invite" name="Accept Invite" element={<AcceptInvite />} />
          <Route exact path="/register/client" name="Client Registration" element={<ClientRegistration />} />
          <Route exact path="/404" name="Page 404" element={<Page404 />} />
          <Route exact path="/500" name="Page 500" element={<Page500 />} />
          <Route exact path="/unauthorized" name="Unauthorized" element={<Unauthorized />} />
          {/* Client self-service portal — separate session, layout and API (see ClientAuthContext). */}
          <Route exact path="/portal/login" name="Client Login" element={<PortalLogin />} />
          <Route path="/co-signer/consent/:token" name="Co-signer Consent" element={<CoSignerConsent />} />
          <Route path="/portal" element={<RequireClientAuth />}>
            <Route element={<ClientLayout />}>
              <Route index element={<Navigate to="/portal/dashboard" replace />} />
              {portalRoutes.map((route) => (
                <Route key={route.path} path={route.path} element={<route.element />} />
              ))}
              <Route path="*" element={<Page404 />} />
            </Route>
          </Route>
          <Route element={<RequireAuth />}>
            <Route path="*" name="Home" element={<DefaultLayout />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
