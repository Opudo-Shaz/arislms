/**
 * Display formatting helpers.
 *
 * @module utils/format
 */

/**
 * Format a number as currency.
 * @param {number|string|null|undefined} amount
 * @param {string} [currency='KES']
 * @returns {string}
 */
export const formatCurrency = (amount, currency = 'KES') => {
  if (amount === null || amount === undefined || amount === '') return '—'
  const num = Number(amount)
  if (Number.isNaN(num)) return '—'
  try {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(num)
  } catch {
    return `${currency} ${num.toLocaleString()}`
  }
}

/**
 * Format an ISO date string as a localized date.
 * @param {string|Date|null|undefined} value
 * @returns {string}
 */
export const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * Format a percentage value (already expressed as a percent, e.g. 5.5 -> "5.5%").
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export const formatPercent = (value) => {
  if (value === null || value === undefined || value === '') return '—'
  const num = Number(value)
  if (Number.isNaN(num)) return '—'
  return `${num}%`
}
