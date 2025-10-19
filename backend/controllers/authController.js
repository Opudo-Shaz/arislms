const authService = require('../services/authService');
const logger = require('../config/logger');

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      logger.warn('Login failed: Missing email or password');
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const result = await authService.login(email, password);

    // Successful login
    logger.info(`User ${email} logged in successfully`);
    res.json({
      message: 'Login successful',
      ...result, 
    });

  } catch (err) {
    if (err.status) {
      logger.warn(`Login failed: ${err.message}`);
      return res.status(err.status).json({ message: err.message });
    }

    logger.error(`Login error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { loginUser };
