/**
 * Business-hours helpers (timezone-aware, no external deps).
 * Config keys: business_hours.timezone | business_hours.days | business_hours.start | business_hours.end
 * `days` uses ISO weekdays: 1 = Monday … 7 = Sunday.
 */
const systemConfigService = require('../services/systemConfigService');

const DEFAULTS = Object.freeze({
  timezone: 'Africa/Nairobi',
  days: [1, 2, 3, 4, 5, 6],
  start: '08:00',
  end: '17:00',
});

const WEEKDAY_INDEX = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const DAY_MS = 24 * 60 * 60 * 1000;
const formatters = new Map();

function getFormatter(timezone) {
  if (!formatters.has(timezone)) {
    formatters.set(timezone, new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      weekday: 'short',
    }));
  }
  return formatters.get(timezone);
}

function toMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return Number(match[2]) <= 59 && minutes <= 24 * 60 ? minutes : null;
}

function parseHHMM(value, fallback) {
  return toMinutes(value) ?? toMinutes(fallback);
}

function isValidTimezone(timezone) {
  try {
    getFormatter(timezone);
    return true;
  } catch {
    return false;
  }
}

/** Loads and normalises the business-hours config. */
async function getBusinessHoursConfig() {
  const [timezone, days, start, end] = await Promise.all([
    systemConfigService.getConfigValue('business_hours.timezone', 'string', DEFAULTS.timezone),
    systemConfigService.getConfigValue('business_hours.days', 'json', DEFAULTS.days),
    systemConfigService.getConfigValue('business_hours.start', 'string', DEFAULTS.start),
    systemConfigService.getConfigValue('business_hours.end', 'string', DEFAULTS.end),
  ]);

  const validDays = Array.isArray(days)
    ? days.map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
    : DEFAULTS.days;

  return {
    timezone: isValidTimezone(timezone) ? timezone : DEFAULTS.timezone,
    days: validDays,
    startMinutes: parseHHMM(start, DEFAULTS.start),
    endMinutes: parseHHMM(end, DEFAULTS.end),
  };
}

/** Wall-clock parts of `date` in `timezone`. */
function localParts(date, timezone) {
  const parts = {};
  for (const { type, value } of getFormatter(timezone).formatToParts(date)) parts[type] = value;
  const hour = Number(parts.hour) % 24;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAY_INDEX[parts.weekday],
    minutesOfDay: hour * 60 + Number(parts.minute),
  };
}

/** 'YYYY-MM-DD' calendar date of `date` in `timezone`. */
function localDateKey(date, timezone) {
  const p = localParts(date, timezone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Whole-day difference between two 'YYYY-MM-DD' strings (b - a). */
function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

function offsetMs(date, timezone) {
  const p = localParts(date, timezone);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Converts a wall-clock time in `timezone` to a UTC Date (DST-safe second pass). */
function zonedWallTimeToDate(year, month, day, minutesOfDay, timezone) {
  const guess = Date.UTC(year, month - 1, day, 0, minutesOfDay);
  const firstOffset = offsetMs(new Date(guess), timezone);
  const secondOffset = offsetMs(new Date(guess - firstOffset), timezone);
  return new Date(guess - secondOffset);
}

function isWithinBusinessHours(date, cfg) {
  const p = localParts(date, cfg.timezone);
  return cfg.days.includes(p.weekday)
    && p.minutesOfDay >= cfg.startMinutes
    && p.minutesOfDay < cfg.endMinutes;
}

/** Start of the next business-hours window (or `date` itself if already inside one); null if no business days configured. */
function nextWindowStart(date, cfg) {
  if (isWithinBusinessHours(date, cfg)) return date;
  if (!cfg.days.length || cfg.startMinutes >= cfg.endMinutes) return null;

  const today = localParts(date, cfg.timezone);
  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    const weekday = candidate.getUTCDay() === 0 ? 7 : candidate.getUTCDay();
    if (!cfg.days.includes(weekday)) continue;
    if (offset === 0 && today.minutesOfDay >= cfg.startMinutes) continue;
    return zonedWallTimeToDate(
      candidate.getUTCFullYear(),
      candidate.getUTCMonth() + 1,
      candidate.getUTCDate(),
      cfg.startMinutes,
      cfg.timezone,
    );
  }
  return null;
}

module.exports = {
  DEFAULTS,
  getBusinessHoursConfig,
  isWithinBusinessHours,
  nextWindowStart,
  localDateKey,
  daysBetween,
};
