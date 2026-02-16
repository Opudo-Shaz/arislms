const express = require('express');
const { loginUser } = require('../controllers/authController');

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

module.exports = router;
