const crypto = require('node:crypto');
const logger = require('../config/logger');

/**
 * HTTP Basic Auth gate for the Swagger UI route. Independent of the app's JWT
 * auth (Swagger UI is a static browser page, not an API client) — credentials
 * come from SWAGGER_UI_USER / SWAGGER_UI_PASS.
 *
 * If either env var is unset, access is denied entirely (fail-closed) rather
 * than falling back to a guessable default, so docs aren't left open by a
 * missing .env entry in production.
 */
function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still run a comparison of equal-length buffers so mismatched-length
    // attempts take a similar amount of time as a real check.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireSwaggerAuth(req, res, next) {
  const expectedUser = process.env.SWAGGER_UI_USER;
  const expectedPass = process.env.SWAGGER_UI_PASS;

  const deny = () => {
    res.set('WWW-Authenticate', 'Basic realm="API Docs"');
    return res.status(401).send('Authentication required');
  };

  if (!expectedUser || !expectedPass) {
    logger.warn('[swaggerAuth] SWAGGER_UI_USER/SWAGGER_UI_PASS not set — denying access to Swagger UI');
    return deny();
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Basic ')) {
    return deny();
  }

  const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) {
    return deny();
  }

  const user = decoded.slice(0, separatorIndex);
  const pass = decoded.slice(separatorIndex + 1);

  if (!timingSafeEqual(user, expectedUser) || !timingSafeEqual(pass, expectedPass)) {
    return deny();
  }

  return next();
}

module.exports = requireSwaggerAuth;
