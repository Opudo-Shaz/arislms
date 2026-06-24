/**
 * Route guard that requires an authenticated session.
 * Renders nested routes via `<Outlet/>` when authenticated, otherwise
 * redirects to `/login`, preserving the attempted location.
 *
 * @module components/RequireAuth
 */

import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const RequireAuth = () => {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
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
