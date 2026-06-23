const express = require('express');
const { getUsers, getUser, createUser, updateUser, deleteUser, resetUserPassword } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @openapi
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: Get all users
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             example:
 *               - id: 1
 *                 name: John Doe
 *                 email: john@test.com
 *                 role: admin
 */
router.get('/', authenticate, authorize([1,2]), getUsers);

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             example:
 *               id: 1
 *               name: Jane Doe
 *               email: jane@test.com
 *               role: user
 */
router.get('/:id', authenticate, getUser);

/**
 * @openapi
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserCreate'
 * 
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             example:
 *               id: 10
 *               name: Alice
 *               email: alice@test.com
 *               role: admin
 */
/**
 * @openapi
 * /api/users/reset-password:
 *   post:
 *     summary: Reset a user's password (super admin only)
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - email
 *               - newPassword
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 5
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@test.com
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 example: TempPass123
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Access denied
 *       404:
 *         description: User not found or email mismatch
 */
router.post('/reset-password', authenticate, authorize([1]), resetUserPassword);

router.post('/', authenticate, authorize([1,2]), createUser);

/**
 * @openapi
 * /api/users/{id}:
 *   put:
 *     summary: Update user
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 10
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserUpdate'
 *     responses:
 *       200:
 *         description: User updated successfully
 */
router.put('/:id', authenticate, authorize([1,2]), updateUser);

/**
 * @openapi
 * /api/users/{id}:
 *   delete:
 *     summary: Delete user
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 10
 *     responses:
 *       200:
 *         description: User deleted successfully
 */
router.delete('/:id', authenticate, authorize([1,2]), deleteUser);

module.exports = router;
