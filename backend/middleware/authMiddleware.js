const jwt = require('jsonwebtoken');
const logger = require('../config/logger'); 

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    logger?.warn('Unauthorized: Missing or invalid Authorization header');
    return res.status(401).json({ message: 'Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
    req.user = decoded;
    next();
  } catch (err) {
    logger?.warn(`Token verification failed: ${err.message}`);
    res.status(403).json({ message: 'Invalid or expired token' });
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
