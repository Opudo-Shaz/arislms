/**
 * Returns `value` after it has stopped changing for `delay` ms.
 * @module hooks/useDebouncedValue
 */

import { useEffect, useState } from 'react'

export const useDebouncedValue = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default useDebouncedValue
