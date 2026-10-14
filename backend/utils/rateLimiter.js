/**
 * Minimal fixed-window, in-memory rate limiter for public endpoints (portal
 * OTP login). Per-process only — adequate for a single instance; swap for a
 * shared store (e.g. Redis) if the API is scaled horizontally.
 */
const logger = require('../config/logger');

/**
 * @param {object} opts
 * @param {number} opts.windowMs   - window length in ms
 * @param {number} opts.max        - max requests per key per window
 * @param {(req) => string} [opts.keyFn] - bucket key (default: client IP)
 * @param {string} [opts.name]     - label for logs
 */
function rateLimit({ windowMs, max, keyFn = (req) => req.ip, name = 'rateLimit' }) {
  const hits = new Map();

  // Sweep expired buckets so the map can't grow without bound.
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of hits) if (bucket.resetAt <= now) hits.delete(key);
  }, windowMs).unref();

  return (req, res, next) => {
    const key = `${name}:${keyFn(req)}`;
    const now = Date.now();
    let bucket = hits.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      hits.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      logger.warn(`[${name}] rate limit exceeded for ${key}`);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ success: false, message: 'Too many requests. Please try again shortly.' });
    }
    next();
  };
}

module.exports = { rateLimit };
