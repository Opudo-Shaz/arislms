/**
 * Cursor state for keyset-paginated lists.
 *
 * Pass the list's filters; whenever they change the hook falls back to the
 * first page in the same render, so a filter change never fires a request with
 * a cursor that belonged to the old filters (no reset effects needed).
 *
 * @module hooks/useCursorPagination
 */

import { useState } from 'react'

/**
 * @param {object} filters every param that should send the list back to page one
 * @returns {{ cursorParams: {cursor?: string, direction?: 'next'|'prev'},
 *   goTo: (cursor: string, direction: 'next'|'prev') => void }}
 */
export const useCursorPagination = (filters = {}) => {
  const key = JSON.stringify(filters)
  const [state, setState] = useState({ key, cursor: undefined, direction: undefined })
  const onCurrentFilters = state.key === key

  return {
    cursorParams: onCurrentFilters ? { cursor: state.cursor, direction: state.direction } : {},
    goTo: (cursor, direction) => setState({ key, cursor, direction }),
  }
}

export default useCursorPagination
