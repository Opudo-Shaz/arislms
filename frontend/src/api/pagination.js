/**
 * Shared keyset-pagination shape. Every list endpoint returns
 * `{ success, data, pagination }` where pagination is
 * `{ limit, hasNext, hasPrev, nextCursor, prevCursor }`. To page, send back
 * `cursor` (nextCursor/prevCursor) with `direction` ('next' | 'prev').
 *
 * @module api/pagination
 */

/** Fallback when a response carries no pagination (first page, nothing more). */
export const EMPTY_PAGINATION = Object.freeze({
  hasNext: false,
  hasPrev: false,
  nextCursor: null,
  prevCursor: null,
})
