/**
 * Country helpers and the minimal fallback used until (or if) `locations.json`
 * can't be loaded. The full list with subdivisions lives in
 * `public/locations.json` and is read through `useLocations`.
 *
 * @module constants/countries
 */

// ISO alpha-2 -> flag emoji via regional indicator symbols.
export const flagOf = (iso) =>
  String.fromCodePoint(...[...iso].map((ch) => 0x1f1a5 + ch.charCodeAt(0)))

export const FALLBACK_COUNTRIES = [
  { iso: 'KE', name: 'Kenya' },
  { iso: 'UG', name: 'Uganda' },
  { iso: 'TZ', name: 'Tanzania' },
  { iso: 'RW', name: 'Rwanda' },
  { iso: 'BI', name: 'Burundi' },
  { iso: 'SS', name: 'South Sudan' },
  { iso: 'CD', name: 'Democratic Republic of Congo' },
  { iso: 'SO', name: 'Somalia' },
].map((c) => ({ ...c, subdivisionLabel: 'County / State', subdivisions: [] }))

export const DEFAULT_COUNTRY = 'Kenya'
export const DEFAULT_POSTAL_CODE = '0000'
