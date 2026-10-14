/**
 * Header for the client self-service portal: sidebar toggle, the client's
 * name, theme switcher and sign-out. A lighter sibling of AppHeader — no
 * staff links or in-app notifications (clients are notified by SMS/email).
 *
 * @component
 */

import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { CButton, CContainer, CHeader, CHeaderNav, CHeaderToggler } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilAccountLogout, cilMenu } from '@coreui/icons'

import AppBreadcrumb from '../components/AppBreadcrumb'
import ThemeSwitcher from '../components/header/ThemeSwitcher'
import { useClientAuth } from '../context/ClientAuthContext'
import { portalRoutes } from '../portalRoutes'

const ClientHeader = () => {
  const headerRef = useRef()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const sidebarShow = useSelector((state) => state.sidebarShow)
  const { client, logout } = useClientAuth()

  useEffect(() => {
    const handleScroll = () => {
      headerRef.current &&
        headerRef.current.classList.toggle('shadow-sm', document.documentElement.scrollTop > 0)
    }
    document.addEventListener('scroll', handleScroll)
    return () => document.removeEventListener('scroll', handleScroll)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/portal/login', { replace: true, state: undefined })
  }

  return (
    <CHeader position="sticky" className="mb-4 p-0" ref={headerRef}>
      <CContainer className="border-bottom px-4" fluid>
        <CHeaderToggler
          onClick={() => dispatch({ type: 'set', sidebarShow: !sidebarShow })}
          style={{ marginInlineStart: '-14px' }}
          aria-label="Toggle navigation"
        >
          <CIcon icon={cilMenu} size="lg" />
        </CHeaderToggler>
        <span className="d-none d-sm-inline text-body-secondary small">
          {client ? `Signed in as ${client.firstName} ${client.lastName}` : ''}
        </span>
        <CHeaderNav className="ms-auto align-items-center">
          <ThemeSwitcher />
          <li className="nav-item py-1">
            <div className="vr h-100 mx-2 text-body text-opacity-75"></div>
          </li>
          <CButton color="secondary" variant="ghost" size="sm" onClick={handleLogout}>
            <CIcon icon={cilAccountLogout} className="me-1" /> Sign out
          </CButton>
        </CHeaderNav>
      </CContainer>
      <CContainer className="px-4" fluid>
        <AppBreadcrumb routes={portalRoutes} homeHref="/portal/dashboard" />
      </CContainer>
    </CHeader>
  )
}

export default ClientHeader
