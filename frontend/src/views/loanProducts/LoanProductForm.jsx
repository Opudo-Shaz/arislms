/**
 * LoanProductForm
 *
 * Modal create/edit form for loan products. When `product` is provided the
 * form is in edit mode; otherwise it creates a new product.
 *
 * @module views/loanProducts/LoanProductForm
 */

import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CCol,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'

import { useCreateLoanProduct, useUpdateLoanProduct } from '../../hooks/useLoanProducts'
import { COLLATERAL_TYPE, DOWN_PAYMENT_TYPE } from '../../constants/enums'

const emptyForm = {
  name: '',
  description: '',
  interestRate: '',
  interestType: 'reducing',
  penaltyRate: '0',
  minimumDownPayment: '0',
  downPaymentType: 'amount',
  repaymentPeriodMonths: '',
  minLoanAmount: '',
  maxLoanAmount: '',
  fees: '0',
  currency: 'KES',
  requiresCollateral: false,
  allowedCollateralTypes: [],
  requiresCoSigner: false,
  isActive: true,
}

const toForm = (p) => ({
  name: p.name || '',
  description: p.description || '',
  interestRate: p.interestRate ?? '',
  interestType: p.interestType || 'reducing',
  penaltyRate: p.penaltyRate ?? '0',
  minimumDownPayment: p.minimumDownPayment ?? '0',
  downPaymentType: p.downPaymentType || 'amount',
  repaymentPeriodMonths: p.repaymentPeriodMonths ?? '',
  minLoanAmount: p.minLoanAmount ?? '',
  maxLoanAmount: p.maxLoanAmount ?? '',
  fees: p.fees ?? '0',
  currency: p.currency || 'KES',
  requiresCollateral: Boolean(p.requiresCollateral),
  allowedCollateralTypes: p.allowedCollateralTypes || [],
  requiresCoSigner: Boolean(p.requiresCoSigner),
  isActive: p.status ? p.status === 'active' : true,
})

const numberOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v))

const toPayload = (form) => ({
  name: form.name.trim(),
  description: form.description.trim() || null,
  interestRate: Number(form.interestRate),
  interestType: form.interestType,
  penaltyRate: Number(form.penaltyRate || 0),
  minimumDownPayment: Number(form.minimumDownPayment || 0),
  downPaymentType: form.downPaymentType,
  repaymentPeriodMonths: Number(form.repaymentPeriodMonths),
  minLoanAmount: numberOrNull(form.minLoanAmount),
  maxLoanAmount: numberOrNull(form.maxLoanAmount),
  fees: Number(form.fees || 0),
  currency: form.currency.trim().toUpperCase(),
  requiresCollateral: form.requiresCollateral,
  allowedCollateralTypes: form.requiresCollateral ? form.allowedCollateralTypes : [],
  requiresCoSigner: form.requiresCoSigner,
  isActive: form.isActive,
})

const LoanProductForm = ({ visible, product, onClose }) => {
  const isEdit = Boolean(product)
  const createMutation = useCreateLoanProduct()
  const updateMutation = useUpdateLoanProduct()
  const saving = createMutation.isPending || updateMutation.isPending

  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (visible) {
      setForm(product ? toForm(product) : emptyForm)
      setError(null)
    }
  }, [visible, product])

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const toggleCollateralType = (type) =>
    setForm((f) => ({
      ...f,
      allowedCollateralTypes: f.allowedCollateralTypes.includes(type)
        ? f.allowedCollateralTypes.filter((t) => t !== type)
        : [...f.allowedCollateralTypes, type],
    }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    const payload = toPayload(form)
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: product.id, payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
      onClose()
    } catch (err) {
      setError(err)
    }
  }

  return (
    <CModal visible={visible} onClose={onClose} size="lg" alignment="center">
      <CForm onSubmit={handleSubmit}>
        <CModalHeader>
          <CModalTitle>{isEdit ? 'Edit Loan Product' : 'New Loan Product'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError(null)}>
              <div>{error.message || 'Failed to save loan product.'}</div>
              {Array.isArray(error.data?.errors) && (
                <ul className="mb-0 mt-2">
                  {error.data.errors.map((m, i) => (
                    <li key={i}>{typeof m === 'string' ? m : m.message}</li>
                  ))}
                </ul>
              )}
            </CAlert>
          )}
          <CRow className="g-3">
            <CCol md={8}>
              <CFormLabel>Name *</CFormLabel>
              <CFormInput value={form.name} onChange={setField('name')} required />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Currency</CFormLabel>
              <CFormInput
                value={form.currency}
                onChange={setField('currency')}
                maxLength={3}
              />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Description</CFormLabel>
              <CFormTextarea rows={2} value={form.description} onChange={setField('description')} />
            </CCol>

            <CCol md={4}>
              <CFormLabel>Interest rate (%) *</CFormLabel>
              <CFormInput
                type="number"
                min="0"
                step="0.01"
                value={form.interestRate}
                onChange={setField('interestRate')}
                required
              />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Interest type</CFormLabel>
              <CFormSelect value={form.interestType} onChange={setField('interestType')}>
                <option value="reducing">Reducing</option>
                <option value="flat">Flat</option>
              </CFormSelect>
            </CCol>
            <CCol md={4}>
              <CFormLabel>Penalty rate (%)</CFormLabel>
              <CFormInput
                type="number"
                min="0"
                step="0.01"
                value={form.penaltyRate}
                onChange={setField('penaltyRate')}
              />
            </CCol>

            <CCol md={4}>
              <CFormLabel>Repayment period (months) *</CFormLabel>
              <CFormInput
                type="number"
                min="1"
                step="1"
                value={form.repaymentPeriodMonths}
                onChange={setField('repaymentPeriodMonths')}
                required
              />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Min loan amount</CFormLabel>
              <CFormInput
                type="number"
                min="0"
                step="0.01"
                value={form.minLoanAmount}
                onChange={setField('minLoanAmount')}
              />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Max loan amount</CFormLabel>
              <CFormInput
                type="number"
                min="0"
                step="0.01"
                value={form.maxLoanAmount}
                onChange={setField('maxLoanAmount')}
              />
            </CCol>

            <CCol md={4}>
              <CFormLabel>Minimum down payment</CFormLabel>
              <CFormInput
                type="number"
                min="0"
                step="0.01"
                value={form.minimumDownPayment}
                onChange={setField('minimumDownPayment')}
              />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Down payment type</CFormLabel>
              <CFormSelect value={form.downPaymentType} onChange={setField('downPaymentType')}>
                {Object.keys(DOWN_PAYMENT_TYPE.labels).map((k) => (
                  <option key={k} value={k}>
                    {DOWN_PAYMENT_TYPE.labels[k]}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={4}>
              <CFormLabel>Fees</CFormLabel>
              <CFormInput
                type="number"
                min="0"
                step="0.01"
                value={form.fees}
                onChange={setField('fees')}
              />
            </CCol>
            <CCol md={4} className="d-flex align-items-end">
              <CFormCheck
                label="Active"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
            </CCol>

            <CCol xs={12}>
              <CFormCheck
                label="Requires collateral"
                checked={form.requiresCollateral}
                onChange={(e) =>
                  setForm((f) => ({ ...f, requiresCollateral: e.target.checked }))
                }
              />
            </CCol>
            <CCol xs={12}>
              <CFormCheck
                label="Requires co-signer"
                checked={form.requiresCoSigner}
                onChange={(e) =>
                  setForm((f) => ({ ...f, requiresCoSigner: e.target.checked }))
                }
              />
            </CCol>
            {form.requiresCollateral && (
              <CCol xs={12}>
                <CFormLabel>Allowed collateral types</CFormLabel>
                <div className="d-flex gap-3 flex-wrap">
                  {COLLATERAL_TYPE.values.map((type) => (
                    <CFormCheck
                      key={type}
                      label={COLLATERAL_TYPE.labels[type]}
                      checked={form.allowedCollateralTypes.includes(type)}
                      onChange={() => toggleCollateralType(type)}
                    />
                  ))}
                </div>
              </CCol>
            )}
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton type="button" color="secondary" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </CButton>
          <CButton type="submit" color="primary" disabled={saving}>
            {saving && <CSpinner size="sm" className="me-2" />}
            {isEdit ? 'Save Changes' : 'Create Product'}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

LoanProductForm.propTypes = {
  visible: PropTypes.bool.isRequired,
  product: PropTypes.object,
  onClose: PropTypes.func.isRequired,
}

LoanProductForm.defaultProps = {
  product: null,
}

export default LoanProductForm
