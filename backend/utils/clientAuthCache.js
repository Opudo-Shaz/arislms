/**
 * Cache-aside wrapper for the auth-relevant client fields that
 * authMiddleware.authenticateClient checks on every portal request — the
 * client-portal counterpart of utils/authUserCache.js. Kept under a separate
 * key namespace so a client id can never collide with a staff user id.
 *
 * Every write path that can revoke portal access (status/isActive change,
 * portal toggle, token_version bump) must call invalidateAuthClient().
 */

const cache = require('./appCache');
const { getOrSet } = require('./cacheAside');
const Client = require('../models/clientModel');

const cacheKey = (id) => `auth:client:${id}`;

/**
 * Returns { id, firstName, lastName, status, isActive, portalEnabled, tokenVersion }
 * for the client, or null if it no longer exists.
 * @param {number} id
 */
async function getCachedAuthClient(id) {
  return getOrSet(cache, cacheKey(id), undefined, async () => {
    const client = await Client.findByPk(id, {
      attributes: ['id', 'firstName', 'lastName', 'status', 'isActive', 'portalEnabled', 'tokenVersion'],
    });
    return client ? client.toJSON() : null;
  });
}

/** Evicts the cached auth entry for a client. */
function invalidateAuthClient(id) {
  cache.del(cacheKey(id));
}

module.exports = { getCachedAuthClient, invalidateAuthClient };
