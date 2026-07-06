/**
 * SystemConfigList
 *
 * Admin-only view for managing runtime system configurations.
 * Features:
 * - Category filter
 * - Inline status toggle (PATCH /:id/status — no modal needed)
 * - Create / edit via modal
 * - Delete via ConfirmModal
 * - Read-only (infra) rows shown with a lock badge; cannot be edited or deleted
 *
 * @module views/systemConfig/SystemConfigList
 */

import React, { useRef, useState } from 'react'

import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormSwitch,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CPagination,
  CPaginationItem,
  CRow,
  CSpinner,
  CAlert,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilPencil, cilPlus, cilReload, cilTrash } from '@coreui/icons'

import DataTable from '../../components/DataTable'
import ConfirmModal from '../../components/ConfirmModal'
import { useAuth } from '../../context/AuthContext'
import {
  useSystemConfigs,
  useCreateSystemConfig,
  useUpdateSystemConfig,
  useToggleSystemConfigStatus,
  useDeleteSystemConfig,
} from '../../hooks/useSystemConfigs'

const PAGE_SIZE = 10

const CATEGORIES = ['general', 'storage', 'notifications', 'loans', 'integrations']

const CATEGORY_COLORS = {
  storage: 'info',
  notifications: 'warning',
  loans: 'primary',
  integrations: 'secondary',
  general: 'light',
}

const emptyForm = {
  key: '',
  label: '',
  value: '',
  category: 'general',
  description: '',
  isActive: true,
  isBoolean: false,
}

const toForm = (c) => ({
  key: c.key || '',
  label: c.label || '',
  value: c.value || '',
  category: c.category || 'general',
  description: c.description || '',
  isActive: c.isActive !== false,
  isBoolean: c.isBoolean === true,
})

// ── Inline create/edit modal ──────────────────────────────────────────────────

const ConfigForm = ({ visible, config, onClose }) => {
  const isEdit = Boolean(config)
  const createMutation = useCreateSystemConfig()
  const updateMutation = useUpdateSystemConfig()
  const saving = createMutation.isPending || updateMutation.isPending

  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)

  React.useEffect(() => {
    if (visible) {
      setForm(config ? toForm(config) : emptyForm)
      setError(null)
    }
  }, [visible, config])

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [field]: val }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      if (isEdit) {
        const { key: _k, ...updatePayload } = form
        await updateMutation.mutateAsync({ id: config.id, payload: updatePayload })
      } else {
        await createMutation.mutateAsync(form)
      }
      onClose()
    } catch (err) {
      const msgs = err?.data?.errors?.map((e) => e.message).join(', ')
      setError(msgs || err?.data?.message || err.message || 'Save failed')
    }
  }

  return (
    <CModal visible={visible} onClose={onClose} size="lg" backdrop="static">
      <CModalHeader>
        <CModalTitle>{isEdit ? 'Edit Configuration' : 'New Configuration'}</CModalTitle>
      </CModalHeader>
      <CForm onSubmit={handleSubmit}>
        <CModalBody>
          {error && <CAlert color="danger">{error}</CAlert>}
          <CRow className="g-3">
            <CCol md={6}>
              <CFormLabel>Key <span className="text-danger">*</span></CFormLabel>
              <CFormInput
                value={form.key}
                onChange={set('key')}
                placeholder="storage.provider"
                disabled={isEdit}
                required
              />
              {!isEdit && (
                <div className="form-text">Lowercase letters, digits, dots, underscores</div>
              )}
            </CCol>
            <CCol md={6}>
              <CFormLabel>Label <span className="text-danger">*</span></CFormLabel>
              <CFormInput
                value={form.label}
                onChange={set('label')}
                placeholder="Storage Provider"
                required
              />
            </CCol>
            <CCol xs={12}>
              <CFormSwitch
                label="Boolean / feature-flag config (uses Status toggle as the value)"
                checked={form.isBoolean}
                onChange={set('isBoolean')}
              />
            </CCol>
            {!form.isBoolean && (
              <CCol md={8}>
                <CFormLabel>Value <span className="text-danger">*</span></CFormLabel>
                <CFormInput
                  value={form.value}
                  onChange={set('value')}
                  placeholder="e.g. local, azure, aws"
                  required
                />
              </CCol>
            )}
            <CCol md={form.isBoolean ? 12 : 4}>
              <CFormLabel>Category</CFormLabel>
              <CFormSelect value={form.category} onChange={set('category')}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol xs={12}>
              <CFormSwitch
                label="Active"
                checked={form.isActive}
                onChange={set('isActive')}
              />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Description</CFormLabel>
              <CFormTextarea
                rows={2}
                value={form.description}
                onChange={set('description')}
                placeholder="What does this configuration control?"
              />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </CButton>
          <CButton color="primary" type="submit" disabled={saving}>
            {saving ? <CSpinner size="sm" className="me-1" /> : null}
            {isEdit ? 'Save Changes' : 'Create'}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

// ── Main list component ───────────────────────────────────────────────────────

const SystemConfigList = () => {
  const { role } = useAuth()
  const isAdmin = role === 1

  const [categoryFilter, setCategoryFilter] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceRef = useRef(null)
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toDelete, setToDelete] = useState(null)

  const queryParams = {
    page,
    limit: PAGE_SIZE,
    ...(categoryFilter ? { category: categoryFilter } : {}),
    ...(debouncedSearch ? { q: debouncedSearch } : {}),
  }
  const { data: result, isLoading, error, refetch, isFetching } = useSystemConfigs(queryParams)

  const configs = result?.data ?? []
  const total = result?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const toggleMutation = useToggleSystemConfigStatus()
  const deleteMutation = useDeleteSystemConfig()

  const handleSearchChange = (e) => {
    const val = e.target.value
    setSearch(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDebouncedSearch(val); setPage(1) }, 350)
  }

  const openCreate = () => { setEditing(null); setShowForm(true) }
  const openEdit = (c) => { setEditing(c); setShowForm(true) }

  const handleToggle = (c) => {
    if (!isAdmin || c.isReadOnly) return
    toggleMutation.mutate(c.id)
  }

  const handleDelete = async () => {
    if (!toDelete) return
    await deleteMutation.mutateAsync(toDelete.id)
    setToDelete(null)
  }

  const columns = [
    {
      key: 'label',
      label: 'Name / Key',
      render: (row) => (
        <div>
          <div className="fw-semibold">
            {row.label}
            {row.isReadOnly && (
              <CBadge color="secondary" className="ms-2 fw-normal">
                <CIcon icon={cilLockLocked} size="sm" className="me-1" />env
              </CBadge>
            )}
          </div>
          <div className="text-body-secondary small font-monospace">{row.key}</div>
          {row.description && (
            <div className="text-body-secondary small mt-1">{row.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (row) => (
        <CBadge color={CATEGORY_COLORS[row.category] || 'light'} textColor={row.category === 'general' ? 'dark' : undefined} shape="rounded-pill">
          {row.category}
        </CBadge>
      ),
    },
    {
      key: 'value',
      label: 'Value',
      render: (row) =>
        row.isBoolean ? (
          <span className="text-body-secondary fst-italic">boolean</span>
        ) : (
          <span className="font-monospace">{row.value || <span className="text-body-secondary">—</span>}</span>
        ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => {
        const isToggling = toggleMutation.isPending && toggleMutation.variables === row.id
        return (
          <CFormSwitch
            checked={row.isActive}
            onChange={() => handleToggle(row)}
            disabled={!isAdmin || row.isReadOnly || isToggling}
            title={row.isReadOnly ? 'Managed by environment variable' : row.isActive ? 'Disable' : 'Enable'}
          />
        )
      },
    },
    {
      key: 'actions',
      label: '',
      className: 'text-end',
      render: (row) =>
        isAdmin && !row.isReadOnly ? (
          <div className="d-flex justify-content-end gap-2">
            <CButton color="primary" variant="outline" size="sm" onClick={() => openEdit(row)}>
              <CIcon icon={cilPencil} />
            </CButton>
            <CButton
              color="danger"
              variant="outline"
              size="sm"
              onClick={() => setToDelete(row)}
            >
              <CIcon icon={cilTrash} />
            </CButton>
          </div>
        ) : null,
    },
  ]

  return (
    <>
      <CCard>
        <CCardHeader className="d-flex align-items-center gap-2 flex-wrap">
          <span className="fw-semibold me-auto">System Configurations</span>

          <CFormSelect
            size="sm"
            style={{ width: 'auto' }}
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </CFormSelect>

          <CButton
            color="secondary"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <CIcon icon={cilReload} />
          </CButton>

          {isAdmin && (
            <CButton color="primary" size="sm" onClick={openCreate}>
              <CIcon icon={cilPlus} className="me-1" /> New Config
            </CButton>
          )}
        </CCardHeader>

        <CCardBody>
          <CFormInput
            size="sm"
            className="mb-3"
            placeholder="Search name, key, value, description…"
            value={search}
            onChange={handleSearchChange}
          />
          <DataTable columns={columns} rows={configs} loading={isLoading} error={error?.message} />
          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <span className="small text-body-secondary">
                {total} configs · page {page} of {totalPages}
              </span>
              <CPagination className="mb-0">
                <CPaginationItem disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </CPaginationItem>
                <CPaginationItem disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </CPaginationItem>
              </CPagination>
            </div>
          )}
        </CCardBody>
      </CCard>

      <ConfigForm
        visible={showForm}
        config={editing}
        onClose={() => { setShowForm(false); setEditing(null) }}
      />

      <ConfirmModal
        visible={Boolean(toDelete)}
        title="Delete Configuration"
        body={`Delete "${toDelete?.label}" (${toDelete?.key})? This cannot be undone.`}
        confirmText="Delete"
        confirmColor="danger"
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
        loading={deleteMutation.isPending}
      />
    </>
  )
}

export default SystemConfigList
