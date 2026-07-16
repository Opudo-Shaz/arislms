const express = require('express');
const { loginUser, forgotPassword, resetPassword } = require('../controllers/authController');

const router = express.Router();

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Login a user and get a JWT token
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             email: ethan@example.com
 *             password: password12345
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *         content:
 *           application/json:
 *             example:
 *               token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       401:
 *         description: Invalid email or password
 *         content:
 *           application/json:
 *             example:
 *               error: Invalid credentials
 */
router.post('/login', loginUser);

/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request a self-service password reset email
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *           example:
 *             email: user@example.com
 *     responses:
 *       200:
 *         description: >
 *           Always returns 200 regardless of whether the email exists
 *           (prevents email enumeration).
 */
router.post('/forgot-password', forgotPassword);

/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     summary: Consume a reset token and set a new password
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *           example:
 *             token: "abc123..."
 *             newPassword: "NewSecure@123"
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired token
 */
router.post('/reset-password', resetPassword);

module.exports = router;
