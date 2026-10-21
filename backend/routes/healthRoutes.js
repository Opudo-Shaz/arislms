const express = require('express');
const sequelize = require('../config/sequalize_db');
const { liveness, createReadinessHandler } = require('../controllers/healthController');

/**
 * Public health probes for load balancers / uptime monitors. Mounted before the
 * request logger in server.js so frequent probes don't flood the logs.
 * Intentionally not rate limited: probes often share one source IP and a 429
 * would read as an outage; readiness DB checks are cached instead.
 */
const router = express.Router();

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Liveness probe
 *     description: Returns 200 while the process is up and serving requests. Does not touch the database.
 *     tags:
 *       - Health
 *     security: []
 *     responses:
 *       200:
 *         description: Process is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 uptime:
 *                   type: integer
 *                   description: Process uptime in seconds
 *                   example: 3600
 *                 timestamp:
 *                   type: string
 *                   description: Current time in the server timezone, with UTC offset
 *                   example: "2026-10-21T09:01:37.354+03:00"
 *                 timezone:
 *                   type: string
 *                   description: IANA timezone (TZ env var, default Africa/Nairobi)
 *                   example: Africa/Nairobi
 *                 utcOffset:
 *                   type: string
 *                   example: "+03:00"
 */
router.get('/', liveness);

/**
 * @openapi
 * /api/health/ready:
 *   get:
 *     summary: Readiness probe
 *     description: |
 *       Checks that dependencies (the database) are reachable. The result is cached for 5 seconds,
 *       so the database is queried at most once per window regardless of traffic.
 *     tags:
 *       - Health
 *     security: []
 *     responses:
 *       200:
 *         description: All dependencies are up
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 checks:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: string
 *                       enum: [up, down]
 *                 timestamp:
 *                   type: string
 *                   description: Current time in the server timezone, with UTC offset
 *                   example: "2026-10-21T09:01:37.354+03:00"
 *                 timezone:
 *                   type: string
 *                   description: IANA timezone (TZ env var, default Africa/Nairobi)
 *                   example: Africa/Nairobi
 *                 utcOffset:
 *                   type: string
 *                   example: "+03:00"
 *       503:
 *         description: One or more dependencies are down (`status` is `unavailable`)
 */
router.get('/ready', createReadinessHandler({ ping: () => sequelize.authenticate() }));

module.exports = router;
