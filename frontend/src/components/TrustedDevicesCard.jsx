/**
 * TrustedDevicesCard
 *
 * Lists the devices a client has trusted for portal sign-in and lets the
 * viewer remove one. Shared by the client portal (the client's own devices)
 * and the admin client detail (Super Admin, on the client's behalf).
 * Removing a device ends its sessions immediately.
 *
 * @module components/TrustedDevicesCard
 */

import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CSpinner } from '@coreui/react'

import ConfirmModal from './ConfirmModal'
import { describeUserAgent } from '../utils/userAgent'
import { formatDateTime } from '../utils/format'
import toast from '../utils/toast'

const TrustedDevicesCard = ({
  title = 'Trusted devices',
  description,
  devices,
  isLoading,
  error,
  onRemove,
  removeWarning,
}) => {
  const [target, setTarget] = useState(null)
  const [removing, setRemoving] = useState(false)

  const confirm = async () => {
    setRemoving(true)
    try {
      await onRemove(target)
      toast.success('Device removed')
      setTarget(null)
    } catch (err) {
      toast.error(err?.message || 'Could not remove the device.')
    } finally {
      setRemoving(false)
    }
  }

  const list = devices ?? []

  return (
    <>
      <CCard className="mb-4">
        <CCardHeader>
          <strong>{title}</strong>
        </CCardHeader>
        <CCardBody>
          {description ? <p className="text-body-secondary small">{description}</p> : null}
          {isLoading ? (
            <div className="text-center py-3">
              <CSpinner size="sm" color="primary" />
            </div>
          ) : error ? (
            <CAlert color="danger" className="mb-0">
              {error.message || 'Could not load devices.'}
            </CAlert>
          ) : list.length === 0 ? (
            <div className="text-body-secondary small">No trusted devices.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Last IP</th>
                    <th>Last used</th>
                    <th>Trusted since</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.map((d) => (
                    <tr key={d.id}>
                      <td>
                        {describeUserAgent(d.userAgent)}
                        {d.current ? (
                          <CBadge color="success" className="ms-2">
                            This device
                          </CBadge>
                        ) : null}
                      </td>
                      <td>{d.lastIp || '—'}</td>
                      <td>{formatDateTime(d.lastSeenAt)}</td>
                      <td>{formatDateTime(d.trustedAt)}</td>
                      <td className="text-end">
                        <CButton color="danger" variant="outline" size="sm" onClick={() => setTarget(d)}>
                          Remove
                        </CButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CCardBody>
      </CCard>

      <ConfirmModal
        visible={Boolean(target)}
        title="Remove device"
        body={
          <>
            <p className="mb-2">
              Remove <strong>{describeUserAgent(target?.userAgent)}</strong>? It will be signed out immediately and
              will need a new code and an ID check to sign in again.
            </p>
            {target?.current && removeWarning ? <p className="mb-0 text-warning-emphasis">{removeWarning}</p> : null}
          </>
        }
        confirmText="Remove"
        confirmColor="danger"
        loading={removing}
        onConfirm={confirm}
        onClose={() => !removing && setTarget(null)}
      />
    </>
  )
}

TrustedDevicesCard.propTypes = {
  title: PropTypes.string,
  description: PropTypes.node,
  devices: PropTypes.arrayOf(PropTypes.object),
  isLoading: PropTypes.bool,
  error: PropTypes.object,
  /** Called with the device row; return a promise that rejects on failure. */
  onRemove: PropTypes.func.isRequired,
  /** Extra warning shown when removing the device currently in use. */
  removeWarning: PropTypes.node,
}

export default TrustedDevicesCard
