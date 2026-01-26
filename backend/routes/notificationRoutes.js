const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/authMiddleware');

/**
 * @openapi
 * /api/notifications:
 *   get:
 *     summary: Get my notifications
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of notifications for logged-in user
 *         content:
 *           application/json:
 *             example:
 *               - id: 1
 *                 title: Payment Received
 *                 message: Your payment of 500 was received
 *                 read: false
 *                 createdAt: 2026-01-20T10:15:00Z
 *               - id: 2
 *                 title: Loan Approved
 *                 message: Your loan has been approved
 *                 read: true
 *                 createdAt: 2026-01-18T08:30:00Z
 */
router.get('/', authenticate, notificationController.getMyNotifications);

/**
 * @openapi
 * /api/notifications/{id}/read:
 *   put:
 *     summary: Mark notification as read
 *     tags:
 *       - Notifications
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
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             example:
 *               id: 1
 *               read: true
 */
router.put('/:id/read', authenticate, notificationController.markNotificationRead);

module.exports = router;
