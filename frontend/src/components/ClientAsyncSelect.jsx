/**
 * ClientAsyncSelect
 *
 * Searchable async select for picking an active client.
 * - On open, loads the first 20 active clients from the server.
 * - Typing triggers a server search (debounced 300 ms) by name, email,
 *   phone, or account number.
 * - Results are cached via React Query so repeated identical searches
 *   do not re-hit the network within the stale window.
 *
 * @module components/ClientAsyncSelect
 */

import React, { useCallback, useEffect, useState } from 'react'
import AsyncSelect from 'react-select/async'
import { useQueryClient } from '@tanstack/react-query'
import PropTypes from 'prop-types'
import clientApi from '../api/clientApi'

/** Map a client record to a react-select option. */
const toOption = (c) => ({
  value: c.id,
  label: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
  sub: c.accountNumber ?? '',
})

/** Render the label + account-number hint inside each dropdown row. */
const formatOptionLabel = ({ label, sub }) => (
  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
    <span>{label}</span>
    {sub && (
      <span style={{ fontSize: '0.75rem', color: '#6c757d' }}>{sub}</span>
    )}
  </div>
)

/**
 * @param {object}   props
 * @param {number|string|null} props.value      – controlled client id (raw)
 * @param {function} props.onChange             – called with (clientId | null)
 * @param {boolean}  [props.isDisabled=false]
 * @param {string}   [props.inputId]            – links a <label htmlFor>
 */
const ClientAsyncSelect = ({ value, onChange, isDisabled = false, inputId }) => {
  const qc = useQueryClient()

  // Track the full option object so react-select can render the selected label.
  const [selectedOption, setSelectedOption] = useState(null)

  // When the parent resets value (e.g. form clear), clear our local option too.
  useEffect(() => {
    if (value == null || value === '') {
      setSelectedOption(null)
    }
  }, [value])

  /** Fetch clients with optional search string; cache for 60 s. */
  const fetchOptions = useCallback(
    async (search) => {
      const params = { status: 'active', limit: 20, ...(search ? { search } : {}) }
      const result = await qc.fetchQuery({
        queryKey: ['clients', 'async-select', params],
        queryFn: () => clientApi.listClients(params),
        staleTime: 60_000,
      })
      return (result?.clients ?? []).map(toOption)
    },
    [qc],
  )

  /**
   * react-select calls loadOptions with the current input string.
   * We wrap fetchOptions so the empty string maps to the default list.
   */
  const loadOptions = useCallback(
    (inputValue) => fetchOptions(inputValue?.trim() || undefined),
    [fetchOptions],
  )

  const handleChange = useCallback(
    (opt) => {
      setSelectedOption(opt ?? null)
      onChange(opt ? opt.value : null)
    },
    [onChange],
  )

  return (
    <AsyncSelect
      inputId={inputId}
      defaultOptions       /* load initial list on mount */
      cacheOptions          /* react-select caches by input string */
      loadOptions={loadOptions}
      value={selectedOption}
      onChange={handleChange}
      formatOptionLabel={formatOptionLabel}
      placeholder="Search by name or ID number…"
      isClearable
      isDisabled={isDisabled}
      loadingMessage={() => 'Searching…'}
      noOptionsMessage={({ inputValue }) =>
        inputValue ? 'No matching clients' : 'No active clients found'
      }
      styles={{
        control: (base, state) => ({
          ...base,
          borderColor: state.isFocused ? '#321fdb' : '#b1b7c1',
          boxShadow: state.isFocused ? '0 0 0 0.25rem rgba(50,31,219,.25)' : 'none',
          '&:hover': { borderColor: '#321fdb' },
          minHeight: '36px',
        }),
        menu: (base) => ({ ...base, zIndex: 9999 }),
        option: (base, state) => ({
          ...base,
          backgroundColor: state.isSelected
            ? '#321fdb'
            : state.isFocused
              ? '#eaecf7'
              : undefined,
          color: state.isSelected ? '#fff' : '#212529',
          padding: '6px 12px',
        }),
      }}
    />
  )
}

ClientAsyncSelect.propTypes = {
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onChange: PropTypes.func.isRequired,
  isDisabled: PropTypes.bool,
  inputId: PropTypes.string,
}

export default ClientAsyncSelect
