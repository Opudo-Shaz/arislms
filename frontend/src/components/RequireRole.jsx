/**
 * Role-based route guard.
 *
 * Wrap a screen with `<RequireRole roles={[1, 2]}>...</RequireRole>` to
 * restrict it to specific backend role ids (1=admin, 2=manager, 3=limited).
 * A user holding several roles passes when ANY of them is listed.
 * Unauthorized users are redirected to a 403/unauthorized view.
 *
 * @module components/RequireRole
 */

import React from 'react'
import PropTypes from 'prop-types'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const RequireRole = ({ roles, children }) => {
  const { roles: userRoles } = useAuth()

  if (roles && roles.length && !userRoles.some((r) => roles.includes(r))) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}

RequireRole.propTypes = {
  roles: PropTypes.arrayOf(PropTypes.number).isRequired,
  children: PropTypes.node,
}

export default RequireRole
