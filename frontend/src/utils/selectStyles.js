/**
 * Theme-aware react-select styles. Uses CoreUI CSS variables so the select
 * follows the active light/dark color mode.
 */
export const themedSelectStyles = {
  control: (base, state) => ({
    ...base,
    backgroundColor: 'var(--cui-body-bg)',
    borderColor: state.isFocused ? 'var(--cui-primary)' : 'var(--cui-border-color)',
    boxShadow: state.isFocused ? '0 0 0 0.25rem rgba(var(--cui-primary-rgb), .25)' : 'none',
    '&:hover': { borderColor: 'var(--cui-primary)' },
    minHeight: '36px',
  }),
  menu: (base) => ({
    ...base,
    zIndex: 9999,
    backgroundColor: 'var(--cui-body-bg)',
    border: '1px solid var(--cui-border-color)',
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? 'var(--cui-primary)'
      : state.isFocused
        ? 'var(--cui-tertiary-bg)'
        : 'transparent',
    color: state.isSelected ? '#fff' : 'var(--cui-body-color)',
    padding: '6px 12px',
    '&:active': { backgroundColor: 'var(--cui-secondary-bg)' },
  }),
  singleValue: (base) => ({ ...base, color: 'var(--cui-body-color)' }),
  input: (base) => ({ ...base, color: 'var(--cui-body-color)' }),
  placeholder: (base) => ({ ...base, color: 'var(--cui-secondary-color)' }),
  indicatorSeparator: (base) => ({ ...base, backgroundColor: 'var(--cui-border-color)' }),
  dropdownIndicator: (base) => ({ ...base, color: 'var(--cui-secondary-color)' }),
  clearIndicator: (base) => ({ ...base, color: 'var(--cui-secondary-color)' }),
  noOptionsMessage: (base) => ({ ...base, color: 'var(--cui-secondary-color)' }),
  loadingMessage: (base) => ({ ...base, color: 'var(--cui-secondary-color)' }),
}
