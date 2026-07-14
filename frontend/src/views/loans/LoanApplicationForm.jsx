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
import { Navigate, useNavigate, useLocation } from 'react-router-dom'
import {
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
import { useLoanProducts } from '../../hooks/useLoanProducts'
import { useAuth } from '../../context/AuthContext'
import { COLLATERAL_TYPE, ROLE_GROUPS } from '../../constants/enums'
import { formatCurrency, formatPercent } from '../../utils/format'
import swal from '../../utils/useSweetAlert'
import ClientAsyncSelect from '../../components/ClientAsyncSelect'

const today = () => new Date().toISOString().slice(0, 10)

const emptyForm = {
  clientId: '',
  loanProductId: '',
  principalAmount: '',
  startDate: today(),
  coSignerId: '',
  collateralType: '',
  collateralDetails: '',
  collateralReferenceNumber: '',
  collateralRegistrationNumber: '',
  collateralEstimatedValue: '',
  collateralNotes: '',
  notes: '',
}

/** Build the API payload; only attach collateral when type + details are set. */
const toPayload = (form) => {
  const payload = {
    clientId: Number(form.clientId),
    loanProductId: Number(form.loanProductId),
    principalAmount: Number(form.principalAmount),
    startDate: form.startDate,
  }
  if (form.coSignerId) payload.coSignerId = Number(form.coSignerId)
  if (form.collateralType.trim() && form.collateralDetails.trim()) {
    payload.collateral = {
      type: form.collateralType.trim(),
      details: form.collateralDetails.trim(),
      ...(form.collateralReferenceNumber.trim() ? { referenceNumber: form.collateralReferenceNumber.trim() } : {}),
      ...(form.collateralRegistrationNumber.trim() ? { registrationNumber: form.collateralRegistrationNumber.trim() } : {}),
      ...(form.collateralEstimatedValue ? { estimatedValue: Number(form.collateralEstimatedValue) } : {}),
      ...(form.collateralNotes.trim() ? { notes: form.collateralNotes.trim() } : {}),
    }
  }
  if (form.notes.trim()) payload.notes = form.notes.trim()
  return payload
}

const LoanApplicationForm = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { role } = useAuth()

  // Must be opened from ClientDetail — clientId + name supplied via router state.
  const prefilledClientId = location.state?.clientId ?? null
  const prefilledClientName = location.state?.clientName ?? null

  const createMutation = useCreateLoan()
  const { data: products = [], isLoading: loadingProducts } = useLoanProducts()

  const [form, setForm] = useState({ ...emptyForm, clientId: prefilledClientId ?? '' })

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.id) === String(form.loanProductId)),
    [products, form.loanProductId],
  )

  // Guard: redirect non-staff roles to unauthorized.
  if (!ROLE_GROUPS.STAFF.includes(role)) return <Navigate to="/unauthorized" replace />

  // Guard: redirect to clients if not opened from a client detail page.
  if (!prefilledClientId) return <Navigate to="/clients" replace />

  const fireError = (message, details) => {
    swal.alert.error('Loan Creation Failed!', message, details)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Client-side collateral validation
    if (selectedProduct?.requiresCollateral) {
      if (!form.collateralType.trim()) {
        swal.toast.warning('Collateral type is required for this loan product.')
        return
      }
      if (!form.collateralDetails.trim()) {
        swal.toast.warning('Collateral description is required.')
        return
      }
      if (!form.collateralReferenceNumber.trim() && !form.collateralRegistrationNumber.trim()) {
        swal.toast.warning('Either a reference number or registration number must be provided for the collateral.')
        return
      }
      if (!form.collateralEstimatedValue) {
        swal.toast.warning('Estimated value is required for the collateral.')
        return
      }
    }

    // Client-side co-signer validation
    if (selectedProduct?.requiresCoSigner && !form.coSignerId) {
      swal.toast.warning('A co-signer is required for the selected loan product.')
      return
    }

    try {
      const created = await createMutation.mutateAsync(toPayload(form))
      navigate(created?.id ? `/loans/${created.id}` : '/loans')
    } catch (err) {
      const details = Array.isArray(err.data?.errors) ? err.data.errors : null
      fireError(err.message || 'Failed to create loan application.', details)
    }
  }

  const saving = createMutation.isPending

  return (
    <CCard className="mb-4">
      <CCardHeader>
        <strong>New Loan Application</strong>
      </CCardHeader>
      <CCardBody>
        <CForm onSubmit={handleSubmit}>
          <CRow className="g-3">
            <CCol md={6}>
              <CFormLabel>Client *</CFormLabel>
              {prefilledClientId ? (
                <div className="form-control bg-body-secondary">{prefilledClientName || `Client #${prefilledClientId}`}</div>
              ) : (
                <>
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
                </>
              )}
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
                    <span>
                      <span className="text-body-secondary">Co-signer: </span>
                      {selectedProduct.requiresCoSigner ? 'Required' : 'Not required'}
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

            {selectedProduct?.requiresCoSigner && (
              <>
                <CCol xs={12}>
                  <hr className="mb-0" />
                  <div className="d-flex align-items-center gap-2 mt-2">
                    <span className="fw-semibold small">Co-signer</span>
                    <span className="badge bg-danger-subtle text-danger small">Required</span>
                  </div>
                </CCol>
                <CCol md={6}>
                  <CFormLabel htmlFor="cosigner-select">Co-signer *</CFormLabel>
                  <ClientAsyncSelect
                    inputId="cosigner-select"
                    value={form.coSignerId || null}
                    onChange={(id) => setForm((f) => ({ ...f, coSignerId: id != null ? String(id) : '' }))}
                  />
                  <div className="form-text">
                    Search by name or account number. Must be a different active client.
                  </div>
                </CCol>
              </>
            )}

            {selectedProduct?.requiresCollateral && (
              <>
                <CCol xs={12}>
                  <hr className="mb-0" />
                  <div className="d-flex align-items-center gap-2 mt-2">
                    <span className="fw-semibold small">Collateral</span>
                    <span className="badge bg-danger-subtle text-danger small">Required</span>
                  </div>
                </CCol>
                <CCol md={4}>
                  <CFormLabel>Collateral type *</CFormLabel>
                  <CFormSelect value={form.collateralType} onChange={setField('collateralType')} required>
                    <option value="">—</option>
                    {COLLATERAL_TYPE.values.map((v) => (
                      <option key={v} value={v}>
                        {COLLATERAL_TYPE.labels[v]}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>
                <CCol md={8}>
                  <CFormLabel>Description *</CFormLabel>
                  <CFormInput
                    value={form.collateralDetails}
                    onChange={setField('collateralDetails')}
                    placeholder="e.g. Toyota Vitz 2018, KBZ 123A"
                    required
                  />
                </CCol>
                <CCol md={6}>
                  <CFormLabel>Reference number</CFormLabel>
                  <CFormInput
                    value={form.collateralReferenceNumber}
                    onChange={setField('collateralReferenceNumber')}
                    placeholder="Document / asset reference no."
                  />
                </CCol>
                <CCol md={6}>
                  <CFormLabel>Registration number</CFormLabel>
                  <CFormInput
                    value={form.collateralRegistrationNumber}
                    onChange={setField('collateralRegistrationNumber')}
                    placeholder="Vehicle reg. / title reg. no."
                  />
                </CCol>
                <CCol xs={12}>
                  <div className="form-text text-warning-emphasis">
                    At least one of reference number or registration number is required.
                  </div>
                </CCol>
                <CCol md={4}>
                  <CFormLabel>Estimated value *</CFormLabel>
                  <CFormInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.collateralEstimatedValue}
                    onChange={setField('collateralEstimatedValue')}
                    required
                  />
                </CCol>
                <CCol md={8}>
                  <CFormLabel>Collateral notes</CFormLabel>
                  <CFormInput
                    value={form.collateralNotes}
                    onChange={setField('collateralNotes')}
                    placeholder="Any additional info about this collateral"
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
              onClick={() => prefilledClientId ? navigate(-1) : navigate('/loans')}
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
