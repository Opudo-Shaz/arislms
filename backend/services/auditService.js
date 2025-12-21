const AuditLog = require('../models/auditLogModel');

class AuditService {
  /**
   * Record an audit log entry
   * @param {Object} auditData - Audit log data
   * @param {string} auditData.entityType - Type of entity (e.g., 'USER', 'LOAN', 'CLIENT')
   * @param {string} auditData.entityId - ID of the entity
   * @param {string} auditData.action - Action performed (CREATE, UPDATE, DELETE)
   * @param {Object} auditData.commandAsJson - The data/command that was executed
   * @param {string} auditData.actorId - ID of the user/service that performed the action
   * @param {string} auditData.actorType - Type of actor (USER, SERVICE, SYSTEM)
   * @param {string} auditData.correlationId - Optional correlation ID for tracking
   * @param {string} auditData.source - Optional source of the request
   * @returns {Promise<Object>} Created audit log record
   */
  static async logAction(auditData) {
    try {
      const auditEntry = await AuditLog.create({
        entity_type: auditData.entityType,
        entity_id: auditData.entityId,
        action: auditData.action.toUpperCase(),
        command_as_json: auditData.commandAsJson,
        actor_id: auditData.actorId,
        actor_type: auditData.actorType.toUpperCase(),
        occurred_at: new Date(),
        correlation_id: auditData.correlationId || null,
        source: auditData.source || null,
      });
      return auditEntry;
    } catch (error) {
      console.error('Error logging audit action:', error);
      throw error;
    }
  }

  /**
   * Get audit logs for a specific entity
   * @param {string} entityType - Type of entity
   * @param {string} entityId - ID of the entity
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Audit log records
   */
  static async getAuditsByEntity(entityType, entityId, options = {}) {
    try {
      const { limit = 100, offset = 0, order = 'DESC' } = options;
      const logs = await AuditLog.findAll({
        where: {
          entity_type: entityType,
          entity_id: entityId,
        },
        limit,
        offset,
        order: [['occurred_at', order]],
      });
      return logs;
    } catch (error) {
      console.error('Error retrieving audit logs:', error);
      throw error;
    }
  }

  /**
   * Get audit logs for a specific actor
   * @param {string} actorId - ID of the actor
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Audit log records
   */
  static async getAuditsByActor(actorId, options = {}) {
    try {
      const { limit = 100, offset = 0, order = 'DESC' } = options;
      const logs = await AuditLog.findAll({
        where: {
          actor_id: actorId,
        },
        limit,
        offset,
        order: [['occurred_at', order]],
      });
      return logs;
    } catch (error) {
      console.error('Error retrieving audit logs by actor:', error);
      throw error;
    }
  }

  /**
   * Get all audit logs with optional filtering
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Audit logs and count
   */
  static async getAuditLogs(filters = {}, options = {}) {
    try {
      const { limit = 100, offset = 0, order = 'DESC' } = options;
      const where = {};

      if (filters.entityType) where.entity_type = filters.entityType;
      if (filters.action) where.action = filters.action.toUpperCase();
      if (filters.actorType) where.actor_type = filters.actorType.toUpperCase();

      const { rows, count } = await AuditLog.findAndCountAll({
        where,
        limit,
        offset,
        order: [['occurred_at', order]],
      });

      return {
        data: rows,
        total: count,
        limit,
        offset,
      };
    } catch (error) {
      console.error('Error retrieving audit logs:', error);
      throw error;
    }
  }
}

module.exports = AuditService;
