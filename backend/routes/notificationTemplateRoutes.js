const express = require('express');
const router = express.Router();
const notificationTemplateController = require('../controllers/notificationTemplateController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validateIdParam } = require('../middleware/validateIdParam');

// Admin-only CRUD for per-event, per-channel notification templates.
router.get('/', authenticate, authorize([1]), notificationTemplateController.getAllTemplates);
router.post('/', authenticate, authorize([1]), notificationTemplateController.createTemplate);
router.get('/:id', authenticate, authorize([1]), validateIdParam(), notificationTemplateController.getTemplateById);
router.put('/:id', authenticate, authorize([1]), validateIdParam(), notificationTemplateController.updateTemplate);
router.delete('/:id', authenticate, authorize([1]), validateIdParam(), notificationTemplateController.deleteTemplate);

module.exports = router;
