/**
 * Unauthorized (403) view shown when a user lacks the required role.
 * @module views/pages/unauthorized/Unauthorized
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { CButton, CCol, CContainer, CRow } from '@coreui/react'

const Unauthorized = () => {
  const navigate = useNavigate()
  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={6} className="text-center">
            <div className="clearfix">
              <h1 className="float-start display-3 me-4">403</h1>
              <h4 className="pt-3">Access denied</h4>
              <p className="text-body-secondary float-start">
                You do not have permission to view this page.
              </p>
            </div>
            <CButton color="primary" onClick={() => navigate('/dashboard')}>
              Back to dashboard
            </CButton>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default Unauthorized
