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
      maximumFractionDigits: 1,
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
 * Format an ISO date string as a localized date and time (to the second).
 * @param {string|Date|null|undefined} value
 * @returns {string}
 */
export const formatDateTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
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

/**
 * Format a loan product's repayment period range, e.g. "3–12 months" or "6 months".
 * @param {number|string|null|undefined} min
 * @param {number|string|null|undefined} max
 * @returns {string}
 */
export const formatTermRange = (min, max) => {
  const lo = Number(min)
  const hi = Number(max)
  if (!hi) return '—'
  const unit = hi === 1 ? 'month' : 'months'
  return lo && lo !== hi ? `${lo}–${hi} ${unit}` : `${hi} ${unit}`
}

/**
 * List the whole-month terms a product allows, from min to max inclusive.
 * @param {{minRepaymentPeriodMonths?: number, maxRepaymentPeriodMonths?: number}|null|undefined} product
 * @returns {number[]}
 */
export const termOptions = (product) => {
  const lo = Math.max(1, Number(product?.minRepaymentPeriodMonths) || 1)
  const hi = Number(product?.maxRepaymentPeriodMonths) || 0
  return hi >= lo ? Array.from({ length: hi - lo + 1 }, (_, i) => lo + i) : []
}
