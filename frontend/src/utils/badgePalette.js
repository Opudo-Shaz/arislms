/**
 * Badge colour palette utilities.
 *
 * Provides a deterministic, cycling colour assignment for string-keyed
 * categories / labels so any list of values gets a distinct badge colour
 * without hardcoding a per-value map.
 *
 * Usage:
 *   import { getBadgeForValue, BADGE_PALETTE } from '../utils/badgePalette'
 *
 *   const badge = getBadgeForValue('email', CATEGORIES)
 *   // → { color: 'success' }   (position of 'email' in CATEGORIES drives the index)
 *
 *   // Or when you already have the index:
 *   const badge = BADGE_PALETTE[2]
 *   // → { color: 'info' }
 *
 * Each palette entry maps directly to CoreUI CBadge props:
 *   <CBadge color={badge.color} textColor={badge.textColor} />
 */

/**
 * All CoreUI badge colours available for auto-assignment, ordered for visual
 * variety. `textColor: 'dark'` is included for light-background colours that
 * need a dark foreground to stay readable.
 *
 * @type {Array<{ color: string, textColor?: string }>}
 */
export const BADGE_PALETTE = [
  { color: 'primary' },
  { color: 'success' },
  { color: 'info' },
  { color: 'warning',  textColor: 'dark' },
  { color: 'secondary' },
  { color: 'danger' },
  { color: 'dark' },
  { color: 'indigo' },
  { color: 'teal' },
  { color: 'pink' },
]

/**
 * Assign a palette entry to a value by its position in a reference list,
 * cycling back to the start when the palette is exhausted.
 *
 * @param {string} value        - The value to look up (e.g. a category name)
 * @param {string[]} valueList  - Ordered list that drives index assignment
 * @param {{ color: string, textColor?: string }} [fallback]
 * @returns {{ color: string, textColor?: string }}
 */
export function getBadgeForValue(value, valueList, fallback = { color: 'secondary' }) {
  const index = valueList.indexOf(value)
  if (index === -1) return fallback
  return BADGE_PALETTE[index % BADGE_PALETTE.length]
}
