/**
 * Route guard for the client self-service portal. Renders nested routes when
 * a client session exists, otherwise redirects to the portal login. Staff
 * sessions do not satisfy it (see ClientAuthContext).
 *
 * @module components/RequireClientAuth
 */

import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useClientAuth } from '../context/ClientAuthContext'

const RequireClientAuth = () => {
  const { isAuthenticated } = useClientAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/portal/login"
        replace
        state={{ from: { pathname: location.pathname, search: location.search } }}
      />
    )
  }

  return <Outlet />
}

export default RequireClientAuth
