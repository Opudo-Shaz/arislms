/**
 * Countries and their subdivisions from the static `locations.json`.
 *
 * Fetched once (prefetched at startup), cached for the session and mirrored to
 * localStorage so the next visit has data immediately. `countries` is never
 * empty: it falls back to a built-in country list (no subdivisions) if the file
 * can't be loaded, in which case forms degrade to free-text county input.
 *
 * @module hooks/useLocations
 */

import { useQuery } from '@tanstack/react-query'
import locationsApi from '../api/locationsApi'
import { FALLBACK_COUNTRIES } from '../constants/countries'

const STORAGE_KEY = 'aris_locations'

const readCached = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(parsed?.countries) ? parsed : undefined
  } catch {
    return undefined
  }
}

export const locationsQueryOptions = {
  queryKey: ['locations'],
  queryFn: async () => {
    const data = await locationsApi.getLocations()
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Storage full/unavailable: the in-memory cache still works.
    }
    return data
  },
  staleTime: Infinity,
  gcTime: Infinity,
  placeholderData: readCached,
}

/** @returns {{ countries: object[], getCountry: (name: string) => object|undefined, isLoading: boolean, isError: boolean }} */
export const useLocations = () => {
  const { data, isLoading, isError } = useQuery(locationsQueryOptions)
  const countries = data?.countries?.length ? data.countries : FALLBACK_COUNTRIES
  return {
    countries,
    getCountry: (name) => countries.find((c) => c.name === name),
    isLoading,
    isError,
  }
}

export default useLocations
