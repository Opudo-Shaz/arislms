/**
 * Turn a raw User-Agent string into a short label like "Chrome on Windows".
 * Best-effort only (order matters: Edge/Opera UAs also contain "Chrome").
 *
 * @param {string|null|undefined} ua
 * @returns {string}
 */
export const describeUserAgent = (ua) => {
  if (!ua) return 'Unknown device'
  const browser =
    (/Edg\//.test(ua) && 'Edge') ||
    (/OPR\/|Opera/.test(ua) && 'Opera') ||
    (/SamsungBrowser/.test(ua) && 'Samsung Internet') ||
    (/Firefox\//.test(ua) && 'Firefox') ||
    (/Chrome\/|CriOS/.test(ua) && 'Chrome') ||
    (/Safari\//.test(ua) && 'Safari') ||
    null
  const os =
    (/Windows/.test(ua) && 'Windows') ||
    (/Android/.test(ua) && 'Android') ||
    (/iPhone|iPad|iPod/.test(ua) && 'iOS') ||
    (/Mac OS X|Macintosh/.test(ua) && 'macOS') ||
    (/Linux/.test(ua) && 'Linux') ||
    null
  if (browser && os) return `${browser} on ${os}`
  return browser || os || 'Unknown device'
}
