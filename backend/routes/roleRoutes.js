const express = require('express');
const router = express.Router();
const RoleController = require('../controllers/roleController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

/**
 * @openapi
 * /api/roles:
 *   post:
 *     summary: Create a new role
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             name: Manager
 *             description: Manages operations
 *     responses:
 *       201:
 *         description: Role created successfully
 *         content:
 *           application/json:
 *             example:
 *               id: 5
 *               name: Manager
 *               description: Manages operations
 */
router.post('/', authenticate, authorize([1,2]), RoleController.createRole);

/**
 * @openapi
 * /api/roles:
 *   get:
 *     summary: Get all roles
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of roles
 *         content:
 *           application/json:
 *             example:
 *               - id: 1
 *                 name: Admin
 *               - id: 2
 *                 name: User
 */
router.get('/', authenticate, RoleController.getAllRoles);

/**
 * @openapi
 * /api/roles/{id}:
 *   get:
 *     summary: Get role by ID
 *     tags:
 *       - Roles
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
 *         description: Role details
 *         content:
 *           application/json:
 *             example:
 *               id: 1
 *               name: Admin
 *               description: Full system access
 */
router.get('/:id', authenticate, RoleController.getRoleById);

/**
 * @openapi
 * /api/roles/{id}:
 *   put:
 *     summary: Update role
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 3
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             name: Supervisor
 *             description: Supervises staff
 *     responses:
 *       200:
 *         description: Role updated successfully
 */
router.put('/:id', authenticate, authorize([1,2]), RoleController.updateRole);

/**
 * @openapi
 * /api/roles/{id}/permissions:
 *   post:
 *     summary: Add permission to role
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 2
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             permissionId: 10
 *     responses:
 *       200:
 *         description: Permission added successfully
 */
router.post('/:id/permissions', authenticate, authorize([1,2]), RoleController.addPermission);

/**
 * @openapi
 * /api/roles/{id}/permissions:
 *   delete:
 *     summary: Remove permission from role
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 2
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             permissionId: 10
 *     responses:
 *       200:
 *         description: Permission removed successfully
 */
router.delete('/:id/permissions', authenticate, authorize([1,2]), RoleController.removePermission);

/**
 * @openapi
 * /api/roles/{id}:
 *   delete:
 *     summary: Delete role
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 4
 *     responses:
 *       200:
 *         description: Role deleted successfully
 */
router.delete('/:id', authenticate, authorize([1,2]), RoleController.deleteRole);

module.exports = router;
