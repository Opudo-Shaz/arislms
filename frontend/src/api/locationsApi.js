/**
 * Locations API.
 *
 * `locations.json` is a static asset in `frontend/public` (countries and their
 * subdivisions). Edit that file to add or change entries; no backend involved.
 *
 * @module api/locationsApi
 */

const LOCATIONS_URL = `${import.meta.env.BASE_URL}locations.json`

/** Keep only well-formed countries so a bad edit can't break the forms. */
const normalize = (raw) => {
  const countries = (Array.isArray(raw?.countries) ? raw.countries : [])
    .filter((c) => c && typeof c.iso === 'string' && typeof c.name === 'string')
    .map((c) => ({
      iso: c.iso.toUpperCase(),
      name: c.name,
      subdivisionLabel: c.subdivisionLabel || 'County / State',
      subdivisions: [...new Set((Array.isArray(c.subdivisions) ? c.subdivisions : []).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      ),
    }))
  if (!countries.length) throw new Error('locations.json has no valid countries')
  return { version: raw.version ?? 0, countries }
}

/** Fetch revalidates via ETag, so edits to the file reach users on their next load. */
export const getLocations = async () => {
  const res = await fetch(LOCATIONS_URL, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`Failed to load locations (${res.status})`)
  return normalize(await res.json())
}

export default { getLocations }
