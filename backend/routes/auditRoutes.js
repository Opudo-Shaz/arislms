const express = require('express');
const AuditController = require('../controllers/auditController');

const router = express.Router();

// Get all audit logs with filtering
router.get('/', AuditController.getAuditLogs);

// Get audit logs for a specific entity
router.get('/entity/:entityType/:entityId', AuditController.getEntityAuditLogs);

// Get audit logs for a specific actor
router.get('/actor/:actorId', AuditController.getActorAuditLogs);

module.exports = router;
