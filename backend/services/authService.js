const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const logger = require('../config/logger');
const AuditLogger = require('../utils/auditLogger');

const login = async (email, password, userAgent = 'unknown') => {
  try {
    //Find user by email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      const error = new Error('Invalid credentials');
      error.status = 401;
      throw error;
    }

    //Validate password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      const error = new Error('Invalid credentials');
      error.status = 401;
      throw error;
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'secretkey',
      { expiresIn: '14d' }
    );

    // Log successful login to audit table
    await AuditLogger.log({
      entityType: 'LOGIN',
      entityId: user.id,
      action: 'CREATE',
      data: { email, role: user.role },
      actorId: user.id,
      options: {
        actorType: 'USER',
        source: userAgent
      }
    });

    logger.info(`User ${user.id} (${email}) successfully logged in`);

    return {
      token,
      expiresIn: 1209600, 
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  } catch (error) {
    logger.error(`Login error for email ${email}: ${error.message}`);
    throw error;
  }
};

module.exports = { login };
