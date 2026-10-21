const logger = require('../config/logger');

const withTimeout = (promise, ms) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

const noStore = (res) => res.set('Cache-Control', 'no-store');

const DEFAULT_TIMEZONE = 'Africa/Nairobi';

// Same resolution as the cron jobs: TZ env var, falling back to the business default.
const resolveTimezone = (tz = process.env.TZ) => {
  for (const candidate of [tz, DEFAULT_TIMEZONE]) {
    try {
      if (candidate) {
        new Intl.DateTimeFormat('en-US', { timeZone: candidate });
        return candidate;
      }
    } catch {
      // invalid IANA name — try the next candidate
    }
  }
  return 'UTC';
};

/** ISO-8601 wall-clock time in `timeZone` with its UTC offset, e.g. 2026-10-21T09:01:37.354+03:00. */
function zonedTimestamp(date, timeZone) {
  const p = {};
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  for (const { type, value } of parts) p[type] = value;

  const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
  const wallAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const offsetMin = Math.round((wallAsUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  const sign = offsetMin < 0 ? '-' : '+';
  const abs = Math.abs(offsetMin);
  const offset = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;

  return {
    timestamp: `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.${ms}${offset}`,
    utcOffset: offset,
  };
}

function timeInfo(date = new Date(), tz) {
  const timezone = resolveTimezone(tz);
  return { timezone, ...zonedTimestamp(date, timezone) };
}

function liveness(req, res) {
  noStore(res).status(200).json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    ...timeInfo(),
  });
}

/**
 * Readiness checks the DB, but caches the result for `cacheMs` and shares one
 * in-flight check between concurrent callers, so DB load stays bounded no
 * matter how often the endpoint is hit (in place of rate limiting).
 */
function createReadinessHandler({ ping, cacheMs = 5000, timeoutMs = 3000, now = Date.now }) {
  let cached = null;
  let inFlight = null;

  const check = () => {
    if (cached && cached.expiresAt > now()) return Promise.resolve(cached.result);
    if (!inFlight) {
      inFlight = withTimeout(Promise.resolve().then(ping), timeoutMs)
        .then(() => 'up')
        .catch((err) => {
          logger.error(`[health] database check failed: ${err.message}`);
          return 'down';
        })
        .then((database) => {
          const result = { database };
          cached = { result, expiresAt: now() + cacheMs };
          return result;
        })
        .finally(() => { inFlight = null; });
    }
    return inFlight;
  };

  return async function readiness(req, res) {
    const checks = await check();
    const ok = Object.values(checks).every((v) => v === 'up');
    noStore(res).status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'unavailable',
      checks,
      ...timeInfo(),
    });
  };
}

module.exports = { liveness, createReadinessHandler, timeInfo };
