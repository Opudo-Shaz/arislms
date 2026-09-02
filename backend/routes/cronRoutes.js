const express = require('express')
const controller = require('../controllers/cronController')
const { authenticate, requirePermission } = require('../middleware/authMiddleware')

const router = express.Router()

/**
 * @openapi
 * /api/cron-jobs:
 *   get:
 *     summary: List registered cron jobs with metadata and last run (admin/manager)
 *     tags:
 *       - Cron Jobs
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of cron jobs
 */
router.get('/', authenticate, requirePermission('cron:read'), controller.list)

/**
 * @openapi
 * /api/cron-jobs/{key}/runs:
 *   get:
 *     summary: Recent run history for a cron job (admin/manager)
 *     tags:
 *       - Cron Jobs
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
 *         description: Run history
 *       404:
 *         description: Job not found
 */
router.get('/:key/runs', authenticate, requirePermission('cron:read'), controller.runs)

/**
 * @openapi
 * /api/cron-jobs/{key}/run:
 *   post:
 *     summary: Manually trigger a cron job (admin only)
 *     tags:
 *       - Cron Jobs
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
 *         description: Job run result
 *       404:
 *         description: Job not found
 *       409:
 *         description: Job is already running
 */
router.post('/:key/run', authenticate, requirePermission('cron:manage'), controller.run)

module.exports = router
