/**
 * Client IP handling behind a reverse proxy.
 *
 * Express only reads X-Forwarded-For from proxies it is told to trust
 * ("trust proxy"); otherwise req.ip is the TCP peer — for an nginx/Caddy on the
 * same host that is always 127.0.0.1, so every audit entry, trusted-device
 * record and per-IP rate limit would see the same address.
 */

/**
 * Parse the TRUST_PROXY env var into an Express "trust proxy" value.
 *  - unset/empty → 'loopback': trust a proxy on the same host only. Safe by
 *    default (a remote client can't forge X-Forwarded-For because its socket
 *    address isn't loopback) and fixes the common same-host nginx setup.
 *  - 'true'      → trust every hop (only safe if the app is reachable solely via the proxy)
 *  - 'false'/'0' → trust nothing (use the socket address)
 *  - a number    → number of proxy hops in front of the app (e.g. 1)
 *  - otherwise   → Express subnet/keyword list, e.g. 'loopback, 10.0.0.0/8'
 * @param {string|undefined} value
 */
function parseTrustProxy(value) {
  const v = String(value ?? '').trim();
  if (!v) return 'loopback';
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^\d+$/.test(v)) return Number(v) || false;
  return v;
}

/** The caller's IP, with the IPv4-mapped IPv6 prefix (::ffff:1.2.3.4) removed. */
function clientIpOf(req) {
  const ip = req.ip || req.socket?.remoteAddress || '';
  return ip.replace(/^::ffff:/, '') || null;
}

module.exports = { parseTrustProxy, clientIpOf };
