import React from 'react'
import { useNavigate } from 'react-router-dom'
import { CButton, CCol, CContainer, CRow } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilArrowLeft, cilLockLocked } from '@coreui/icons'
import { useAuth } from '../../../context/AuthContext'

const Page404 = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  return (
    <div
      className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center"
      style={{ background: 'linear-gradient(135deg, var(--cui-body-bg) 0%, var(--cui-tertiary-bg) 100%)' }}
    >
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={8} lg={6} className="text-center">
            {/* Large gradient 404 */}
            <div
              style={{
                fontSize: 'clamp(6rem, 20vw, 12rem)',
                fontWeight: 900,
                lineHeight: 1,
                background: 'linear-gradient(135deg, var(--cui-primary) 0%, var(--cui-info) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                marginBottom: '0.5rem',
                userSelect: 'none',
              }}
            >
              404
            </div>

            {/* Accent line */}
            <div
              style={{
                height: 3,
                width: 60,
                margin: '0 auto 1.5rem',
                borderRadius: 99,
                background: 'linear-gradient(90deg, var(--cui-primary), var(--cui-info))',
              }}
            />

            <h2 className="mb-2 fw-semibold">Page Not Found</h2>
            <p
              className="text-body-secondary mb-4"
              style={{ maxWidth: 360, margin: '0 auto 2rem' }}
            >
              The page you&apos;re looking for doesn&apos;t exist or may have been moved.
            </p>

            {isAuthenticated ? (
              <div className="d-flex flex-column flex-sm-row gap-2 justify-content-center">
                <CButton
                  color="primary"
                  size="lg"
                  onClick={() => navigate(-1)}
                  style={{ minWidth: 160 }}
                >
                  <CIcon icon={cilArrowLeft} className="me-2" />
                  Go Back
                </CButton>
                <CButton
                  color="outline-secondary"
                  size="lg"
                  onClick={() => navigate('/dashboard', { replace: true })}
                  style={{ minWidth: 160 }}
                >
                  Dashboard
                </CButton>
              </div>
            ) : (
              <CButton
                color="primary"
                size="lg"
                onClick={() => navigate('/login', { replace: true })}
                style={{ minWidth: 160 }}
              >
                <CIcon icon={cilLockLocked} className="me-2" />
                Go to Login
              </CButton>
            )}
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default Page404
