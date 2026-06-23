/**
 * JournalEntryForm
 *
 * Modal form for posting a manual, balanced journal entry. Supports a dynamic
 * set of debit/credit lines (minimum two) and validates that total debits equal
 * total credits before submitting. Account codes are selected from the active
 * chart of accounts.
 *
 * @module views/accounting/JournalEntryForm
 */

import React, { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CCol,
  CForm,
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
import CIcon from '@coreui/icons-react'
import { cilPlus, cilTrash } from '@coreui/icons'

import { useCreateJournalEntry } from '../../hooks/useLedger'
import { useAccounts } from '../../hooks/useChartOfAccounts'
import { MANUAL_SOURCE_TYPES, LEDGER_SOURCE_TYPE } from '../../constants/enums'
import { formatCurrency } from '../../utils/format'

const today = () => new Date().toISOString().slice(0, 10)

const emptyLine = () => ({ accountCode: '', side: 'debit', amount: '', description: '' })

const emptyForm = () => ({
  entryDate: today(),
  description: '',
  sourceType: 'MANUAL',
  lines: [emptyLine(), emptyLine()],
})

const JournalEntryForm = ({ visible, onClose }) => {
  const createMutation = useCreateJournalEntry()
  const { data: accounts = [] } = useAccounts()

  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (visible) {
      setForm(emptyForm())
      setError(null)
    }
  }, [visible])

  const setLine = (idx, key, value) =>
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) => (i === idx ? { ...l, [key]: value } : l)),
    }))

  const addLine = () => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))

  const removeLine = (idx) =>
    setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }))

  const totals = useMemo(() => {
    let debit = 0
    let credit = 0
    form.lines.forEach((l) => {
      const amt = Number(l.amount) || 0
      if (l.side === 'debit') debit += amt
      else credit += amt
    })
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.01 && debit > 0 }
  }, [form.lines])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (form.lines.length < 2) {
      setError({ message: 'At least two lines are required.' })
      return
    }
    if (form.lines.some((l) => !l.accountCode || !(Number(l.amount) > 0))) {
      setError({ message: 'Each line needs an account and a positive amount.' })
      return
    }
    if (!totals.balanced) {
      setError({ message: 'Total debits must equal total credits (and be greater than zero).' })
      return
    }

    const payload = {
      entryDate: form.entryDate,
      description: form.description.trim() || null,
      sourceType: form.sourceType,
      lines: form.lines.map((l) => ({
        accountCode: l.accountCode,
        debit: l.side === 'debit' ? Number(l.amount) : 0,
        credit: l.side === 'credit' ? Number(l.amount) : 0,
        description: l.description.trim() || null,
      })),
    }

    try {
      await createMutation.mutateAsync(payload)
      onClose()
    } catch (err) {
      setError(err)
    }
  }

  return (
    <CModal visible={visible} onClose={onClose} size="xl" alignment="center">
      <CForm onSubmit={handleSubmit}>
        <CModalHeader>
          <CModalTitle>Post Journal Entry</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError(null)}>
              <div>{error.message || 'Failed to post entry.'}</div>
              {Array.isArray(error.data?.errors) && (
                <ul className="mb-0 mt-2">
                  {error.data.errors.map((m, i) => (
                    <li key={i}>{typeof m === 'string' ? m : m.message}</li>
                  ))}
                </ul>
              )}
            </CAlert>
          )}

          <CRow className="g-3 mb-3">
            <CCol md={4}>
              <CFormLabel>Entry date *</CFormLabel>
              <CFormInput
                type="date"
                value={form.entryDate}
                onChange={(e) => setForm((f) => ({ ...f, entryDate: e.target.value }))}
                required
              />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Source type</CFormLabel>
              <CFormSelect
                value={form.sourceType}
                onChange={(e) => setForm((f) => ({ ...f, sourceType: e.target.value }))}
              >
                {MANUAL_SOURCE_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {LEDGER_SOURCE_TYPE.labels[v]}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={4}>
              <CFormLabel>Description</CFormLabel>
              <CFormInput
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                maxLength={500}
              />
            </CCol>
          </CRow>

          <CFormLabel>Lines *</CFormLabel>
          {form.lines.map((line, idx) => (
            <CRow className="g-2 mb-2 align-items-center" key={idx}>
              <CCol md={4}>
                <CFormSelect
                  value={line.accountCode}
                  onChange={(e) => setLine(idx, 'accountCode', e.target.value)}
                >
                  <option value="">Select account…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.code}>
                      {a.code} – {a.name}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <CFormSelect value={line.side} onChange={(e) => setLine(idx, 'side', e.target.value)}>
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <CFormInput
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount"
                  value={line.amount}
                  onChange={(e) => setLine(idx, 'amount', e.target.value)}
                />
              </CCol>
              <CCol md={3}>
                <CFormInput
                  placeholder="Line description"
                  value={line.description}
                  onChange={(e) => setLine(idx, 'description', e.target.value)}
                  maxLength={255}
                />
              </CCol>
              <CCol md={1} className="text-end">
                <CButton
                  color="danger"
                  size="sm"
                  variant="outline"
                  disabled={form.lines.length <= 2}
                  onClick={() => removeLine(idx)}
                >
                  <CIcon icon={cilTrash} />
                </CButton>
              </CCol>
            </CRow>
          ))}

          <CButton color="light" size="sm" className="mt-1" onClick={addLine}>
            <CIcon icon={cilPlus} className="me-1" />
            Add line
          </CButton>

          <div className="d-flex justify-content-end gap-4 mt-3">
            <div className="text-end">
              <div className="small text-body-secondary">Total Debit</div>
              <div className="fw-semibold">{formatCurrency(totals.debit)}</div>
            </div>
            <div className="text-end">
              <div className="small text-body-secondary">Total Credit</div>
              <div className="fw-semibold">{formatCurrency(totals.credit)}</div>
            </div>
            <div className="text-end">
              <div className="small text-body-secondary">Status</div>
              <div className={`fw-semibold ${totals.balanced ? 'text-success' : 'text-danger'}`}>
                {totals.balanced ? 'Balanced' : 'Unbalanced'}
              </div>
            </div>
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            onClick={onClose}
            disabled={createMutation.isPending}
          >
            Cancel
          </CButton>
          <CButton color="primary" type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending && <CSpinner size="sm" className="me-2" />}
            Post Entry
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

JournalEntryForm.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
}

export default JournalEntryForm
