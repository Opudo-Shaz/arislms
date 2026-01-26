const express = require('express');
const AuditController = require('../controllers/auditController');

const router = express.Router();

/**
 * @openapi
 * /api/audits:
 *   get:
 *     summary: Get all audit logs (with optional filtering)
 *     tags:
 *       - Audits
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter (optional)
 *         example: 2026-01-01
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter (optional)
 *         example: 2026-01-20
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *         description: Filter by entity type (optional)
 *         example: Loan
 *       - in: query
 *         name: actorId
 *         schema:
 *           type: integer
 *         description: Filter by actor ID (optional)
 *         example: 1
 *     responses:
 *       200:
 *         description: List of audit logs
 *         content:
 *           application/json:
 *             example:
 *               - id: 1
 *                 entityType: Loan
 *                 entityId: 5
 *                 action: create
 *                 actorId: 1
 *                 timestamp: 2026-01-15T10:30:00Z
 *               - id: 2
 *                 entityType: Client
 *                 entityId: 3
 *                 action: update
 *                 actorId: 2
 *                 timestamp: 2026-01-16T08:20:00Z
 */
router.get('/', AuditController.getAuditLogs);

/**
 * @openapi
 * /api/audits/entity/{entityType}/{entityId}:
 *   get:
 *     summary: Get audit logs for a specific entity
 *     tags:
 *       - Audits
 *     parameters:
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *         example: Loan
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *     responses:
 *       200:
 *         description: Audit logs for the entity
 *         content:
 *           application/json:
 *             example:
 *               - id: 1
 *                 entityType: Loan
 *                 entityId: 5
 *                 action: create
 *                 actorId: 1
 *                 timestamp: 2026-01-15T10:30:00Z
 */
router.get('/entity/:entityType/:entityId', AuditController.getEntityAuditLogs);

/**
 * @openapi
 * /api/audits/actor/{actorId}:
 *   get:
 *     summary: Get audit logs performed by a specific actor
 *     tags:
 *       - Audits
 *     parameters:
 *       - in: path
 *         name: actorId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Audit logs by the actor
 *         content:
 *           application/json:
 *             example:
 *               - id: 2
 *                 entityType: Client
 *                 entityId: 3
 *                 action: update
 *                 actorId: 1
 *                 timestamp: 2026-01-16T08:20:00Z
 */
router.get('/actor/:actorId', AuditController.getActorAuditLogs);

module.exports = router;
