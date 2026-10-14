/**
 * Public landing page (`/`).
 *
 * Introduces the service, lists active loan products (public endpoint), and
 * routes visitors to the right sign-in: clients to the self-service portal
 * (phone + OTP), staff to the management portal. Visitors who already hold a
 * session get a shortcut straight to their dashboard instead.
 *
 * @component
 */

import React from 'react'
import { Link } from 'react-router-dom'
import {
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CPlaceholder,
  CRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilChartLine, cilMobile, cilShieldAlt, cilWallet } from '@coreui/icons'

import arislmsLogo from '../../assets/brand/arislms_logo_dark.png'
import ThemeSwitcher from '../../components/header/ThemeSwitcher'
import { useAuth } from '../../context/AuthContext'
import { useClientAuth } from '../../context/ClientAuthContext'
import { usePublicLoanProducts } from '../../hooks/usePortal'
import { formatCurrency } from '../../utils/format'

const STEPS = [
  {
    icon: cilMobile,
    title: 'Sign in with your phone',
    body: 'Use the phone number registered with us. We send you a one-time code — no password to remember.',
  },
  {
    icon: cilChartLine,
    title: 'Check your standing',
    body: 'See your credit score, credit limit, active loan, upcoming instalments and full payment history.',
  },
  {
    icon: cilWallet,
    title: 'Apply and repay',
    body: 'Request a new loan in minutes and report repayments you make by M-Pesa so they are applied quickly.',
  },
]

const ProductCard = ({ product }) => (
  <CCard className="h-100">
    <CCardBody className="d-flex flex-column">
      <h3 className="h6 fw-semibold mb-1">{product.name}</h3>
      {product.description ? (
        <p className="small text-body-secondary mb-3">{product.description}</p>
      ) : null}
      <dl className="row small mb-0 mt-auto">
        <dt className="col-5 text-body-secondary fw-normal">Amount</dt>
        <dd className="col-7 mb-1">
          {formatCurrency(product.minLoanAmount, product.currency)} – {formatCurrency(product.maxLoanAmount, product.currency)}
        </dd>
        <dt className="col-5 text-body-secondary fw-normal">Term</dt>
        <dd className="col-7 mb-1">
          Up to {product.repaymentPeriodMonths} month{product.repaymentPeriodMonths === 1 ? '' : 's'}
        </dd>
        <dt className="col-5 text-body-secondary fw-normal">Interest</dt>
        <dd className="col-7 mb-1">
          {product.interestRate}% {product.interestRatePeriod === 'monthly' ? 'per month' : 'per year'}
        </dd>
      </dl>
      {!product.selfServiceAvailable ? (
        <div className="small text-body-secondary mt-2">Collateral required — apply at a branch.</div>
      ) : product.requiresCoSigner ? (
        <div className="small text-body-secondary mt-2">Requires a co-signer who is also a registered client.</div>
      ) : null}
    </CCardBody>
  </CCard>
)

const Home = () => {
  const { isAuthenticated: isStaff } = useAuth()
  const { isAuthenticated: isClient } = useClientAuth()
  const { data: products = [], isLoading } = usePublicLoanProducts()

  return (
    <div className="login-page-bg min-vh-100 d-flex flex-column">
      <header className="border-bottom bg-body">
        <CContainer className="d-flex align-items-center py-2 px-3">
          <img src={arislmsLogo} alt="ARIS LMS" style={{ height: 40, width: 'auto' }} />
          <nav className="ms-auto d-flex align-items-center gap-2">
            <ul className="list-unstyled mb-0 d-flex">
              <ThemeSwitcher />
            </ul>
            {isStaff ? (
              <Link to="/dashboard" className="btn btn-sm btn-outline-secondary">Staff dashboard</Link>
            ) : (
              <Link to="/login" className="btn btn-sm btn-link text-body-secondary">Staff sign in</Link>
            )}
          </nav>
        </CContainer>
      </header>

      <main className="flex-grow-1">
        <CContainer className="px-3 py-5">
          <CRow className="align-items-center g-4">
            <CCol lg={7}>
              <h1 className="display-6 fw-semibold mb-3">Your loans, in your pocket.</h1>
              <p className="lead text-body-secondary mb-4">
                Track your loan balance, see what is due next, check your credit score and apply for
                your next loan — any time, from your phone.
              </p>
              <div className="d-flex flex-wrap gap-2">
                {isClient ? (
                  <Link to="/portal/dashboard">
                    <CButton color="primary" size="lg">Go to my dashboard</CButton>
                  </Link>
                ) : (
                  <Link to="/portal/login">
                    <CButton color="primary" size="lg">Client sign in</CButton>
                  </Link>
                )}
                <a href="#products">
                  <CButton color="secondary" variant="outline" size="lg">View loan products</CButton>
                </a>
              </div>
              <p className="small text-body-secondary mt-3 mb-0">
                <CIcon icon={cilShieldAlt} className="me-1" />
                Not yet a member? Visit a branch to register — your phone number becomes your sign-in.
              </p>
            </CCol>
            <CCol lg={5}>
              <CCard>
                <CCardBody className="p-4">
                  {STEPS.map((step, i) => (
                    <div key={step.title} className={`d-flex gap-3 ${i < STEPS.length - 1 ? 'mb-4' : ''}`}>
                      <div
                        className="flex-shrink-0 d-flex align-items-center justify-content-center rounded-circle bg-primary-subtle text-primary"
                        style={{ width: 40, height: 40 }}
                      >
                        <CIcon icon={step.icon} />
                      </div>
                      <div>
                        <div className="fw-semibold">{step.title}</div>
                        <div className="small text-body-secondary">{step.body}</div>
                      </div>
                    </div>
                  ))}
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>

          <section id="products" className="mt-5 pt-3">
            <h2 className="h4 fw-semibold mb-3">Loan products</h2>
            <CRow className="g-3">
              {isLoading
                ? [0, 1, 2].map((i) => (
                    <CCol key={i} sm={6} lg={4}>
                      <CCard className="h-100">
                        <CCardBody>
                          <CPlaceholder as="p" animation="glow"><CPlaceholder xs={7} /></CPlaceholder>
                          <CPlaceholder as="p" animation="glow"><CPlaceholder xs={10} /><CPlaceholder xs={6} /></CPlaceholder>
                        </CCardBody>
                      </CCard>
                    </CCol>
                  ))
                : products.map((product) => (
                    <CCol key={product.id} sm={6} lg={4}>
                      <ProductCard product={product} />
                    </CCol>
                  ))}
              {!isLoading && products.length === 0 ? (
                <CCol xs={12}>
                  <p className="text-body-secondary">Loan products will be listed here soon.</p>
                </CCol>
              ) : null}
            </CRow>
          </section>
        </CContainer>
      </main>

      <footer className="border-top bg-body py-3">
        <CContainer className="px-3 small text-body-secondary d-flex flex-wrap gap-2">
          <span>&copy; {new Date().getFullYear()} ARIS LMS</span>
          <span className="ms-auto">
            Staff? <Link to="/login">Sign in to the management portal</Link>
          </span>
        </CContainer>
      </footer>
    </div>
  )
}

export default Home
