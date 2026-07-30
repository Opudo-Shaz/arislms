/**
 * Shared in-memory application cache.
 *
 * General-purpose — not limited to System Config. Any module can reuse this
 * singleton for any cacheable object (namespace keys, e.g. "config:storage.provider",
 * "loans:overdueSummary") or create its own NodeCache instance if it needs
 * different TTL/size tuning.
 *
 * Configure the default TTL via APP_CACHE_TTL_SECONDS (default: 300s / 5 min).
 * This TTL is just a safety net — callers are expected to invalidate (del) keys
 * explicitly whenever the underlying data changes, so the same default TTL can
 * be reused across different kinds of cached data.
 */

const NodeCache = require('node-cache');

const TTL_SECONDS = parseInt(process.env.APP_CACHE_TTL_SECONDS || '300', 10);

const cache = new NodeCache({
  stdTTL: TTL_SECONDS,
  checkperiod: 60,
  useClones: false,
});

module.exports = cache;
