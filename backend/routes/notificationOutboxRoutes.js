const express = require('express');
const router = express.Router();
const notificationOutboxController = require('../controllers/notificationOutboxController');
const { authenticate, requirePermission } = require('../middleware/authMiddleware');
const { validateIdParam } = require('../middleware/validateIdParam');

// Admin-only visibility into the delivery queue + manual retry.
router.get('/', authenticate, requirePermission('notifications:manage_outbox'), notificationOutboxController.getAll);
router.get('/:id', authenticate, requirePermission('notifications:manage_outbox'), validateIdParam(), notificationOutboxController.getById);
router.post('/:id/retry', authenticate, requirePermission('notifications:manage_outbox'), validateIdParam(), notificationOutboxController.retry);

module.exports = router;
