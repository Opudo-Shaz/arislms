/**
 * LoanApplicationForm
 *
 * New loan application. Pick an eligible client (verified KYC + active),
 * choose a loan product, enter the principal and start date, and optionally
 * attach collateral. Submitting runs the backend credit-scoring pipeline.
 *
 * @module views/loans/LoanApplicationForm
 */

import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CRow,
  CSpinner,
} from '@coreui/react'

import { useCreateLoan } from '../../hooks/useLoans'
import { useClients } from '../../hooks/useClients'
import { useLoanProducts } from '../../hooks/useLoanProducts'
import { COLLATERAL_TYPE } from '../../constants/enums'
import { formatCurrency, formatPercent } from '../../utils/format'

const today = () => new Date().toISOString().slice(0, 10)

const emptyForm = {
  clientId: '',
  loanProductId: '',
  principalAmount: '',
  startDate: today(),
  collateralType: '',
  collateralDetails: '',
  notes: '',
}

/** Build the API payload; only attach collateral when both fields are set. */
const toPayload = (form) => {
  const payload = {
    clientId: Number(form.clientId),
    loanProductId: Number(form.loanProductId),
    principalAmount: Number(form.principalAmount),
    startDate: form.startDate,
  }
  if (form.collateralType.trim() && form.collateralDetails.trim()) {
    payload.collateral = {
      type: form.collateralType.trim(),
      details: form.collateralDetails.trim(),
    }
  }
  if (form.notes.trim()) payload.notes = form.notes.trim()
  return payload
}

const LoanApplicationForm = () => {
  const navigate = useNavigate()
  const createMutation = useCreateLoan()
  const { data: clients = [], isLoading: loadingClients } = useClients()
  const { data: products = [], isLoading: loadingProducts } = useLoanProducts()

  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState(null)

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  // Only clients with verified KYC and an active account may take a loan.
  const eligibleClients = useMemo(
    () => clients.filter((c) => c.kycStatus === 'verified' && c.status === 'active'),
    [clients],
  )

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.id) === String(form.loanProductId)),
    [products, form.loanProductId],
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrors(null)
    try {
      const created = await createMutation.mutateAsync(toPayload(form))
      navigate(created?.id ? `/loans/${created.id}` : '/loans')
    } catch (err) {
      setErrors(err)
    }
  }

  const saving = createMutation.isPending

  return (
    <CCard className="mb-4">
      <CCardHeader>
        <strong>New Loan Application</strong>
      </CCardHeader>
      <CCardBody>
        {errors && (
          <CAlert color="danger" dismissible onClose={() => setErrors(null)}>
            <div>{errors.message || 'Failed to create loan application.'}</div>
            {Array.isArray(errors.data?.errors) && (
              <ul className="mb-0 mt-2">
                {errors.data.errors.map((m, i) => (
                  <li key={i}>{typeof m === 'string' ? m : m.message}</li>
                ))}
              </ul>
            )}
          </CAlert>
        )}

        <CForm onSubmit={handleSubmit}>
          <CRow className="g-3">
            <CCol md={6}>
              <CFormLabel>Client *</CFormLabel>
              <CFormSelect
                value={form.clientId}
                onChange={setField('clientId')}
                required
                disabled={loadingClients}
              >
                <option value="">Select a client…</option>
                {eligibleClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                    {c.accountNumber ? ` (${c.accountNumber})` : ''}
                  </option>
                ))}
              </CFormSelect>
              <div className="form-text">
                Only clients with verified KYC and an active account are eligible.
              </div>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Loan product *</CFormLabel>
              <CFormSelect
                value={form.loanProductId}
                onChange={setField('loanProductId')}
                required
                disabled={loadingProducts}
              >
                <option value="">Select a product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatPercent(p.interestRate)} {p.interestType}
                  </option>
                ))}
              </CFormSelect>
            </CCol>

            {selectedProduct && (
              <CCol xs={12}>
                <div className="border rounded p-3 bg-body-tertiary small">
                  <div className="d-flex flex-wrap gap-4">
                    <span>
                      <span className="text-body-secondary">Term: </span>
                      {selectedProduct.repaymentPeriodMonths ?? '—'} mo
                    </span>
                    <span>
                      <span className="text-body-secondary">Amount range: </span>
                      {formatCurrency(selectedProduct.minLoanAmount, selectedProduct.currency)} –{' '}
                      {formatCurrency(selectedProduct.maxLoanAmount, selectedProduct.currency)}
                    </span>
                    <span>
                      <span className="text-body-secondary">Fees: </span>
                      {formatCurrency(selectedProduct.fees, selectedProduct.currency)}
                    </span>
                    <span>
                      <span className="text-body-secondary">Collateral: </span>
                      {selectedProduct.requiresCollateral ? 'Required' : 'Not required'}
                    </span>
                  </div>
                </div>
              </CCol>
            )}

            <CCol md={6}>
              <CFormLabel>Principal amount *</CFormLabel>
              <CFormInput
                type="number"
                min="1"
                step="0.01"
                value={form.principalAmount}
                onChange={setField('principalAmount')}
                required
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Start date *</CFormLabel>
              <CFormInput type="date" value={form.startDate} onChange={setField('startDate')} required />
            </CCol>

            {selectedProduct?.requiresCollateral && (
              <>
                <CCol xs={12}>
                  <hr className="mb-0" />
                  <span className="text-body-secondary small">Collateral</span>
                </CCol>
                <CCol md={4}>
                  <CFormLabel>Collateral type</CFormLabel>
                  <CFormSelect value={form.collateralType} onChange={setField('collateralType')}>
                    <option value="">—</option>
                    {COLLATERAL_TYPE.values.map((v) => (
                      <option key={v} value={v}>
                        {COLLATERAL_TYPE.labels[v]}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>
                <CCol md={8}>
                  <CFormLabel>Collateral details</CFormLabel>
                  <CFormInput
                    value={form.collateralDetails}
                    onChange={setField('collateralDetails')}
                    placeholder="e.g. Toyota Vitz 2018, KBZ 123A"
                  />
                </CCol>
              </>
            )}

            <CCol xs={12}>
              <CFormLabel>Notes</CFormLabel>
              <CFormTextarea rows={3} value={form.notes} onChange={setField('notes')} />
            </CCol>
          </CRow>

          <div className="d-flex gap-2 mt-4">
            <CButton type="submit" color="primary" disabled={saving}>
              {saving && <CSpinner size="sm" className="me-2" />}
              Submit Application
            </CButton>
            <CButton
              type="button"
              color="secondary"
              variant="outline"
              onClick={() => navigate('/loans')}
              disabled={saving}
            >
              Cancel
            </CButton>
          </div>
        </CForm>
      </CCardBody>
    </CCard>
  )
}

export default LoanApplicationForm
