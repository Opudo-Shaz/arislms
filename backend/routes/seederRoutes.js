const express = require('express')
const controller = require('../controllers/seederController')
const { authenticate, requireSuperAdmin } = require('../middleware/authMiddleware')

const router = express.Router()

/**
 * @openapi
 * /api/seeders:
 *   get:
 *     summary: List registered seed scripts (Super Admin only)
 *     tags:
 *       - Seeders
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of seeders
 *       403:
 *         description: Not a Super Admin
 */
router.get('/', authenticate, requireSuperAdmin, controller.list)

/**
 * @openapi
 * /api/seeders/{key}/run:
 *   post:
 *     summary: Manually run a seed script against the live database (Super Admin only)
 *     tags:
 *       - Seeders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Seeder run result
 *       403:
 *         description: Not a Super Admin
 *       404:
 *         description: Seeder not found
 */
router.post('/:key/run', authenticate, requireSuperAdmin, controller.run)

module.exports = router
