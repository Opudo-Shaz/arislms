/**
 * Route guard that requires an authenticated session.
 * Renders nested routes via `<Outlet/>` when authenticated, otherwise
 * redirects to `/login`, preserving the attempted location.
 *
 * @module components/RequireAuth
 */

import React from 'react'
import { matchPath, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { routes } from '../routes'
import Page404 from '../views/pages/page404/Page404'

const isKnownRoute = (pathname) => routes.some((route) => matchPath(route.path, pathname))

const RequireAuth = () => {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    // Unknown URLs get the 404 page instead of a pointless login redirect.
    if (!isKnownRoute(location.pathname)) return <Page404 />

    // When redirecting to login, preserve only the pathname the user attempted to access
    // This prevents stale state from previous sessions from affecting new users
    return (
      <Navigate 
        to="/login" 
        replace 
        state={{ 
          from: {
            pathname: location.pathname,
            search: location.search
          }
        }} 
      />
    )
  }

  return <Outlet />
}

export default RequireAuth
