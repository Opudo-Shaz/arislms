const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

/**
 * @openapi
 * /api/reports/portfolio-aging:
 *   get:
 *     summary: Portfolio aging report (outstanding principal bucketed by days overdue)
 *     tags:
 *       - Reports
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: asOf
 *         schema:
 *           type: string
 *         description: Aging reference date (YYYY-MM-DD). Defaults to today.
 *         example: "2026-06-30"
 *     responses:
 *       200:
 *         description: Portfolio aging buckets
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 asOf: "2026-06-30"
 *                 buckets:
 *                   - label: Current
 *                     principalOutstanding: 120000
 *                     count: 8
 *                   - label: "1-30"
 *                     principalOutstanding: 35000
 *                     count: 3
 *                   - label: "31-60"
 *                     principalOutstanding: 12000
 *                     count: 1
 *                   - label: "61-90"
 *                     principalOutstanding: 0
 *                     count: 0
 *                   - label: "90+"
 *                     principalOutstanding: 8000
 *                     count: 1
 *                 totals:
 *                   principalOutstanding: 175000
 *                   count: 13
 */
router.get('/portfolio-aging', authenticate, reportController.getPortfolioAging);

module.exports = router;
