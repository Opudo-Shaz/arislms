/**
 * Cache-aside helper.
 *
 * Generic over any NodeCache instance — reusable for future caches beyond
 * System Config (e.g. loan status aggregates, credit score lookups) without
 * duplicating the check/fetch/store boilerplate at each call site.
 *
 * @param {import('node-cache')} cache - the NodeCache instance to use
 * @param {string} key                 - cache key
 * @param {number|undefined} ttl       - seconds before expiry; omit to use the cache's stdTTL
 * @param {() => Promise<*>} fetchFn   - called on cache miss to compute the value
 * @returns {Promise<*>}
 */
async function getOrSet(cache, key, ttl, fetchFn) {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const value = await fetchFn();

  if (ttl === undefined) {
    cache.set(key, value);
  } else {
    cache.set(key, value, ttl);
  }

  return value;
}

module.exports = { getOrSet };
