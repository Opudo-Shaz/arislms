const AuditService = require('../services/auditService');

class AuditController {
  //Get all audit logs with optional filtering
  static async getAuditLogs(req, res) {
    try {
      const { entityType, action, actorType, limit = 100, offset = 0 } = req.query;

      const filters = {};
      if (entityType) filters.entityType = entityType;
      if (action) filters.action = action;
      if (actorType) filters.actorType = actorType;

      const result = await AuditService.getAuditLogs(filters, {
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
      });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching audit logs',
        error: error.message,
      });
    }
  }

  //Get audit logs for a specific entity
  static async getEntityAuditLogs(req, res) {
    try {
      const { entityType, entityId } = req.params;
      const { limit = 100, offset = 0 } = req.query;

      const logs = await AuditService.getAuditsByEntity(entityType, entityId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      return res.status(200).json({
        success: true,
        data: logs,
      });
    } catch (error) {
      console.error('Error fetching entity audit logs:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching entity audit logs',
        error: error.message,
      });
    }
  }

  //Get audit logs for a specific actor

  static async getActorAuditLogs(req, res) {
    try {
      const { actorId } = req.params;
      const { limit = 100, offset = 0 } = req.query;

      const logs = await AuditService.getAuditsByActor(actorId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      return res.status(200).json({
        success: true,
        data: logs,
      });
    } catch (error) {
      console.error('Error fetching actor audit logs:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching actor audit logs',
        error: error.message,
      });
    }
  }
}

module.exports = AuditController;
