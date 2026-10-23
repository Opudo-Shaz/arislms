/**
 * CountrySubdivisionFields
 *
 * Country select (flag-prefixed, searchable) followed by a dependent
 * county/state select. The subdivision field is disabled until a country is
 * chosen and the locations data is ready, and is cleared when the country
 * changes. Countries without a list (or a failed load) get a free-text input,
 * and a stored value that isn't in the list is kept as an option so editing an
 * older record never drops it.
 *
 * Renders two grid columns; place it directly inside a `CRow`.
 *
 * @module components/CountrySubdivisionFields
 */

import React from 'react'
import PropTypes from 'prop-types'
import { CCol, CFormFeedback, CFormInput, CFormLabel } from '@coreui/react'
import FormSelect from './FormSelect'
import { useLocations } from '../hooks/useLocations'
import { flagOf } from '../constants/countries'

const CountrySubdivisionFields = ({ country = '', subdivision = '', onChange, errors, md = 6 }) => {
  const { countries, getCountry, isLoading } = useLocations()
  const selected = getCountry(country)
  const label = selected?.subdivisionLabel || 'County / State'
  const options = selected?.subdivisions ?? []
  const hasList = options.length > 0
  const loading = isLoading && !hasList
  const legacy = subdivision && hasList && !options.includes(subdivision) ? [subdivision] : []

  const handleCountry = (e) => {
    onChange('country', e.target.value)
    onChange('state', '')
  }

  return (
    <>
      <CCol md={md}>
        <CFormLabel>
          Country <span className="text-danger">*</span>
        </CFormLabel>
        <FormSelect value={country} onChange={handleCountry} required invalid={Boolean(errors?.country)}>
          <option value="">Select country</option>
          {countries.map((c) => (
            <option key={c.iso} value={c.name}>{`${flagOf(c.iso)} ${c.name}`}</option>
          ))}
        </FormSelect>
        {errors?.country && (
          <CFormFeedback invalid style={{ display: 'block' }}>
            {errors.country}
          </CFormFeedback>
        )}
      </CCol>
      <CCol md={md}>
        <CFormLabel>{label}</CFormLabel>
        {!country || loading || hasList ? (
          <FormSelect
            key={country}
            value={subdivision}
            onChange={(e) => onChange('state', e.target.value)}
            disabled={!country || loading}
          >
            <option value="">
              {!country ? 'Select country first' : loading ? 'Loading…' : `Select ${label.toLowerCase()}`}
            </option>
            {[...legacy, ...options].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </FormSelect>
        ) : (
          <CFormInput
            value={subdivision}
            onChange={(e) => onChange('state', e.target.value)}
            placeholder={`Enter ${label.toLowerCase()}`}
            autoComplete="address-level1"
          />
        )}
        {errors?.state && (
          <CFormFeedback invalid style={{ display: 'block' }}>
            {errors.state}
          </CFormFeedback>
        )}
      </CCol>
    </>
  )
}

CountrySubdivisionFields.propTypes = {
  country: PropTypes.string,
  subdivision: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  errors: PropTypes.shape({ country: PropTypes.string, state: PropTypes.string }),
  md: PropTypes.number,
}

export default CountrySubdivisionFields
