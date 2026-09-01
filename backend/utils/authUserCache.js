/**
 * Cache-aside wrapper around the shared appCache for the auth-relevant user
 * fields (existence, status, token_version) that authMiddleware checks on
 * every authenticated request.
 *
 * Reuses the existing appCache/getOrSet pattern (see systemConfigService)
 * instead of hitting the DB per-request. The stdTTL on appCache is just a
 * safety net — every write path that can change these fields (delete,
 * status change, password reset/change) must call invalidateAuthUser() so
 * revocation is effectively immediate rather than waiting out the TTL.
 */

const cache = require('./appCache');
const { getOrSet } = require('./cacheAside');
const User = require('../models/userModel');
const Role = require('../models/roleModel');

const ADMIN_ROLE_ID = 1;

const cacheKey = (id) => `auth:user:${id}`;

/**
 * Returns { id, role_id, status, token_version, permissions } for the given
 * user id, or null if the user no longer exists. Cached; falls back to a DB
 * read on cache miss/expiry.
 *
 * `permissions` is the resolved permission list attached to the user's role.
 * Admin (role id 1) always resolves to the wildcard `['*']` so it never needs
 * an explicit permission list maintained. Because this is cached, every role
 * write path must call invalidateAuthUser() for the affected users (see
 * roleService) so permission changes take effect immediately.
 * @param {number} id
 */
async function getCachedAuthUser(id) {
  return getOrSet(cache, cacheKey(id), undefined, async () => {
    const user = await User.findByPk(id, {
      attributes: ['id', 'role_id', 'status', 'token_version'],
    });
    if (!user) return null;

    const plain = user.toJSON();

    if (plain.role_id === ADMIN_ROLE_ID) {
      plain.permissions = ['*'];
    } else {
      const role = await Role.findByPk(plain.role_id, {
        attributes: ['permissions'],
      });
      plain.permissions = role?.permissions || [];
    }

    return plain;
  });
}

/**
 * Evicts the cached auth entry for a user. Call this whenever a user is
 * deleted or their status/password/token_version changes.
 * @param {number} id
 */
function invalidateAuthUser(id) {
  cache.del(cacheKey(id));
}

module.exports = { getCachedAuthUser, invalidateAuthUser };
