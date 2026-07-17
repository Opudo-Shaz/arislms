const authService = require('../services/authService');
const passwordResetService = require('../services/passwordResetService');
const ResetPasswordRequestDto = require('../dtos/auth/ResetPasswordRequestDto');
const { validateSync } = require('../utils/validationMiddleware');
const logger = require('../config/logger');

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const userAgent = req.headers['user-agent'];

    if (!email || !password) {
      logger.warn('Login failed: Missing email or password');
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const result = await authService.login(email, password, userAgent);

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

/**
 * POST /api/auth/forgot-password
 * Initiates a self-service password reset.
 * Returns 404 when the email is not registered, 503 on email delivery failure.
 */
const forgotPassword = async (req, res) => {
  const validation = validateSync(req.body, ResetPasswordRequestDto.forgotPasswordSchema);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: 'Validation error', errors: validation.errors });
  }

  const { email } = validation.value;
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    await passwordResetService.requestPasswordReset(email, userAgent);
    return res.json({ message: 'Password reset email sent.' });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ message: err.message });
    }
    // Email delivery failure or other system error
    logger.error(`[forgotPassword] Failed to send reset email for ${email}: ${err.message}`);
    return res.status(503).json({
      message: 'A system error prevented sending the reset email. Please try again later.',
    });
  }
};

/**
 * POST /api/auth/reset-password
 * Consumes a reset token and sets the new password.
 */
const resetPassword = async (req, res) => {
  const validation = validateSync(req.body, ResetPasswordRequestDto.resetPasswordSchema);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: 'Validation error', errors: validation.errors });
  }

  const { token, newPassword } = validation.value;
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    await passwordResetService.confirmPasswordReset(token, newPassword, userAgent);
    return res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (err) {
    const status = err.status || 500;
    logger.warn(`[resetPassword] Failed: ${err.message}`);
    return res.status(status).json({ message: err.message });
  }
};

module.exports = { loginUser, forgotPassword, resetPassword };
