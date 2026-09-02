const express = require('express');
const router = express.Router();
const notificationTemplateController = require('../controllers/notificationTemplateController');
const { authenticate, requirePermission } = require('../middleware/authMiddleware');
const { validateIdParam } = require('../middleware/validateIdParam');

// Admin-only CRUD for per-event, per-channel notification templates.
router.get('/', authenticate, requirePermission('notifications:manage_templates'), notificationTemplateController.getAllTemplates);
router.post('/', authenticate, requirePermission('notifications:manage_templates'), notificationTemplateController.createTemplate);
router.get('/:id', authenticate, requirePermission('notifications:manage_templates'), validateIdParam(), notificationTemplateController.getTemplateById);
router.put('/:id', authenticate, requirePermission('notifications:manage_templates'), validateIdParam(), notificationTemplateController.updateTemplate);
router.delete('/:id', authenticate, requirePermission('notifications:manage_templates'), validateIdParam(), notificationTemplateController.deleteTemplate);

module.exports = router;
