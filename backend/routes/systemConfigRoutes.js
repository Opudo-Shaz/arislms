const express = require('express')
const controller = require('../controllers/systemConfigController')
const { authenticate, authorize } = require('../middleware/authMiddleware')

const router = express.Router()

/**
 * @openapi
 * /api/system-configs:
 *   get:
 *     summary: Get all system configs
 *     tags:
 *       - System Configs
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of system configs
 *   post:
 *     summary: Create a new system config (admin only)
 *     tags:
 *       - System Configs
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Config created successfully
 */
// GET all — admin + manager can read
router.get('/', authenticate, authorize([1, 2]), controller.getAll)

/**
 * @openapi
 * /api/system-configs/cache/inspect:
 *   get:
 *     summary: Inspect the shared in-memory app cache (debug, admin only)
 *     tags:
 *       - System Configs
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache stats and entries (secret values redacted)
 */
// GET cache inspect — debug, admin only. Must come before /:id so "cache" isn't treated as an id.
router.get('/cache/inspect', authenticate, authorize([1]), controller.inspectCache)

/**
 * @openapi
 * /api/system-configs/{id}:
 *   get:
 *     summary: Get a system config by ID
 *     tags:
 *       - System Configs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Config details
 *       404:
 *         description: Config not found
 *   put:
 *     summary: Update a system config's value/label/category/description (admin only)
 *     tags:
 *       - System Configs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Config updated successfully
 *       404:
 *         description: Config not found
 *   delete:
 *     summary: Delete a system config (admin only)
 *     tags:
 *       - System Configs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Config deleted
 *       403:
 *         description: Cannot delete an env-driven config
 *       404:
 *         description: Config not found
 */
// GET one
router.get('/:id', authenticate, authorize([1, 2]), controller.getOne)

// POST create — admin only
router.post('/', authenticate, authorize([1]), controller.create)

// PUT update value/label/category/description — admin only
router.put('/:id', authenticate, authorize([1]), controller.update)

/**
 * @openapi
 * /api/system-configs/{id}/status:
 *   patch:
 *     summary: Toggle a system config's active status (admin only)
 *     tags:
 *       - System Configs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Status toggled successfully
 *       404:
 *         description: Config not found
 */
// PATCH toggle isActive — admin only (inline table toggle)
router.patch('/:id/status', authenticate, authorize([1]), controller.toggleStatus)

// DELETE — admin only
router.delete('/:id', authenticate, authorize([1]), controller.remove)

/**
 * @openapi
 * /api/system-configs/{id}/reveal:
 *   get:
 *     summary: Reveal a config's decrypted secret value (admin only, always audit-logged)
 *     tags:
 *       - System Configs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Decrypted value
 *       404:
 *         description: Config not found
 */
// GET reveal decrypted secret value — admin only, always audit-logged
router.get('/:id/reveal', authenticate, authorize([1]), controller.reveal)

module.exports = router
