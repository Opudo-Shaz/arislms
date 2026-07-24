/**
 * CodeValuesManager
 *
 * Modal for managing the values (dropdown options) belonging to a single Code.
 * Supports inline add / edit / delete of values. Admin only.
 *
 * @module views/admin/CodeValuesManager
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
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPencil, cilPlus, cilTrash, cilX } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import ConfirmModal from '../../components/ConfirmModal'
import StatusBadge from '../../components/StatusBadge'
import {
  useCodeValues,
  useCreateCodeValue,
  useUpdateCodeValue,
  useDeleteCodeValue,
} from '../../hooks/useCodes'

const ACTIVE_ENUM = { colors: { true: 'success', false: 'secondary' }, labels: { true: 'Active', false: 'Inactive' } }

const emptyValueForm = { value: '', description: '', sortOrder: 0, isActive: true }

const toValueForm = (v) => ({
  value: v.value || '',
  description: v.description || '',
  sortOrder: v.sortOrder ?? 0,
  isActive: v.isActive !== false,
})

const CodeValuesManager = ({ visible, code, onClose }) => {
  const codeId = code?.id
  const { data: values = [], isLoading, error } = useCodeValues(codeId)
  const createMutation = useCreateCodeValue()
  const updateMutation = useUpdateCodeValue()
  const deleteMutation = useDeleteCodeValue()

  const [editingRow, setEditingRow] = useState(null) // null = not editing, {} = new row
  const [form, setForm] = useState(emptyValueForm)
  const [formError, setFormError] = useState(null)
  const [toDelete, setToDelete] = useState(null)

  useEffect(() => {
    if (visible) {
      setEditingRow(null)
      setForm(emptyValueForm)
      setFormError(null)
      setToDelete(null)
    }
  }, [visible, codeId])

  const startCreate = () => {
    setEditingRow({})
    setForm(emptyValueForm)
    setFormError(null)
  }

  const startEdit = (row) => {
    setEditingRow(row)
    setForm(toValueForm(row))
    setFormError(null)
  }

  const cancelEdit = () => {
    setEditingRow(null)
    setForm(emptyValueForm)
    setFormError(null)
  }

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const saving = createMutation.isPending || updateMutation.isPending

  const handleSave = async (e) => {
    e.preventDefault()
    setFormError(null)
    const payload = {
      value: form.value.trim(),
      description: form.description.trim() || null,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
    }
    try {
      if (editingRow?.id) {
        await updateMutation.mutateAsync({ id: editingRow.id, payload, codeId })
      } else {
        await createMutation.mutateAsync({ codeId, payload })
      }
      cancelEdit()
    } catch (err) {
      setFormError(err)
    }
  }

  const runDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id: toDelete.id, codeId })
      setToDelete(null)
    } catch {
      // Error surfaced via mutation state; modal stays open.
    }
  }

  const columns = [
    { key: 'value', label: 'Value', render: (row) => <span className="fw-semibold">{row.value}</span> },
    { key: 'description', label: 'Description', render: (row) => row.description || '—' },
    { key: 'sortOrder', label: 'Sort Order' },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => <StatusBadge enumDef={ACTIVE_ENUM} value={String(row.isActive !== false)} />,
    },
    {
      key: 'actions',
      label: '',
      className: 'text-end',
      render: (row) => (
        <div className="d-flex gap-2 justify-content-end">
          <CButton color="light" size="sm" title="Edit" onClick={() => startEdit(row)}>
            <CIcon icon={cilPencil} />
          </CButton>
          <CButton
            color="danger"
            size="sm"
            variant="outline"
            title="Delete"
            onClick={() => setToDelete(row)}
          >
            <CIcon icon={cilTrash} />
          </CButton>
        </div>
      ),
    },
  ]

  return (
    <CModal visible={visible} onClose={onClose} alignment="center" size="lg">
      <CModalHeader>
        <CModalTitle>
          Values for <span className="text-body-secondary">{code?.key}</span> — {code?.name}
        </CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div className="d-flex justify-content-end mb-3">
          <CButton color="primary" size="sm" onClick={startCreate} disabled={Boolean(editingRow)}>
            <CIcon icon={cilPlus} className="me-1" />
            Add Value
          </CButton>
        </div>

        {editingRow !== null && (
          <CForm onSubmit={handleSave} className="border rounded p-3 mb-3 bg-body-tertiary">
            {formError && (
              <CAlert color="danger" dismissible onClose={() => setFormError(null)}>
                <div>{formError.message || 'Failed to save value.'}</div>
                {Array.isArray(formError.data?.error) && (
                  <ul className="mb-0 mt-2">
                    {formError.data.error.map((m, i) => (
                      <li key={i}>{typeof m === 'string' ? m : m.message}</li>
                    ))}
                  </ul>
                )}
              </CAlert>
            )}
            <CRow className="g-2 align-items-end">
              <CCol md={3}>
                <label className="form-label">Value *</label>
                <CFormInput value={form.value} onChange={setField('value')} maxLength={120} required />
              </CCol>
              <CCol md={4}>
                <label className="form-label">Description</label>
                <CFormInput value={form.description} onChange={setField('description')} maxLength={500} />
              </CCol>
              <CCol md={2}>
                <label className="form-label">Sort Order</label>
                <CFormInput type="number" value={form.sortOrder} onChange={setField('sortOrder')} />
              </CCol>
              <CCol md={1}>
                <CFormCheck
                  label="Active"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
              </CCol>
              <CCol md={2} className="d-flex gap-2 justify-content-end">
                <CButton type="button" color="secondary" variant="outline" size="sm" onClick={cancelEdit}>
                  <CIcon icon={cilX} />
                </CButton>
                <CButton type="submit" color="primary" size="sm" disabled={saving}>
                  {saving && <CSpinner size="sm" className="me-1" />}
                  Save
                </CButton>
              </CCol>
            </CRow>
          </CForm>
        )}

        <DataTable
          columns={columns}
          rows={values}
          loading={isLoading}
          error={error}
          emptyMessage="No values defined yet."
        />
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" onClick={onClose}>
          Close
        </CButton>
      </CModalFooter>

      <ConfirmModal
        visible={Boolean(toDelete)}
        title="Delete Value"
        body={toDelete ? `Delete value "${toDelete.value}"? This cannot be undone.` : ''}
        confirmText="Delete"
        confirmColor="danger"
        loading={deleteMutation.isPending}
        onConfirm={runDelete}
        onClose={() => setToDelete(null)}
      />
    </CModal>
  )
}

CodeValuesManager.propTypes = {
  visible: PropTypes.bool.isRequired,
  code: PropTypes.object,
  onClose: PropTypes.func.isRequired,
}

export default CodeValuesManager
