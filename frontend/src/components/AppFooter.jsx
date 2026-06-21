import React from 'react'
import { CFooter } from '@coreui/react'

const AppFooter = () => {
  const currentYear = new Date().getFullYear()
  return (
    <CFooter className="px-4">
      <div>
        <a href="https://arislms.co.ke" target="_blank" rel="noopener noreferrer">
          ARIS LMS
        </a>
        <span className="ms-1">&copy; {currentYear} Aris Apps Team.</span>
      </div>
      <div className="ms-auto">
        <span className="me-1">Powered by</span>
        <a href="https://arislms.co.ke" target="_blank" rel="noopener noreferrer">
          ARIS LMS Admin UI &amp; Dashboard
        </a>
      </div>
    </CFooter>
  )
}

export default React.memo(AppFooter)
