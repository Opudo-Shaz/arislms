const express = require('express');
const router = express.Router();
const notificationOutboxController = require('../controllers/notificationOutboxController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validateIdParam } = require('../middleware/validateIdParam');

// Admin-only visibility into the delivery queue + manual retry.
router.get('/', authenticate, authorize([1]), notificationOutboxController.getAll);
router.get('/:id', authenticate, authorize([1]), validateIdParam(), notificationOutboxController.getById);
router.post('/:id/retry', authenticate, authorize([1]), validateIdParam(), notificationOutboxController.retry);

module.exports = router;
