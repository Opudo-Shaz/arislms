const jwt = require('jsonwebtoken');
const logger = require('../config/logger'); 
const UserStatus = require('../enums/userStatus');
const { getCachedAuthUser } = require('../utils/authUserCache');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    logger?.warn('Unauthorized: Missing or invalid Authorization header');
    return res.status(401).json({ message: 'Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');

    // Re-check the account on every request (via the shared app cache, not a
    // DB hit each time — see utils/authUserCache.js). A JWT stays
    // cryptographically valid until it expires, so without this a
    // deleted/suspended user (or one whose password was reset) could keep
    // using an old token until it naturally expired. token_version lets us
    // force-invalidate tokens on demand (see userService: deleteUser/
    // updateUserStatus/resetUserPassword/changeOwnPassword and
    // passwordResetService.confirmPasswordReset — all of which also evict
    // the cache entry so revocation takes effect immediately).
    const user = await getCachedAuthUser(decoded.id);

    if (!user) {
      logger?.warn(`Unauthorized: user ${decoded.id} for token no longer exists`);
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (user.status !== UserStatus.ACTIVE) {
      logger?.warn(`Unauthorized: user ${decoded.id} is ${user.status}`);
      return res.status(403).json({ message: 'Account is no longer active' });
    }

    if ((decoded.tokenVersion || 0) !== (user.token_version || 0)) {
      logger?.warn(`Unauthorized: stale token_version for user ${decoded.id}`);
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    req.user = { id: user.id, role: user.role_id, status: user.status };
    next();
  } catch (err) {
    logger?.warn(`Token verification failed: ${err.message}`);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const authorize = (roles = []) => {
  if (typeof roles === 'string') roles = [roles];
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      logger?.warn(`Access denied: role "${req.user?.role}" not authorized`);
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
