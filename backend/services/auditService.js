const AuditLog = require('../models/auditLogModel');
const User = require('../models/userModel');

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
  /**
   * Get a map of action -> actor full name for a specific entity.
   * Only the earliest occurrence of each action is used.
   * @param {string} entityType - Entity type (e.g. 'LOAN')
   * @param {string|number} entityId - Entity ID
   * @param {string[]} actions - Actions to look up (e.g. ['APPROVE', 'DISBURSE'])
   * @returns {Promise<Object>} Map of action -> actor name (or null if not found)
   */
  static async getActorsByActions(entityType, entityId, actions) {
    try {
      const rows = await AuditLog.findAll({
        where: { entity_type: entityType, entity_id: String(entityId), action: actions },
        order: [['occurred_at', 'ASC']]
      });

      if (!rows.length) return {};

      const actorIds = [...new Set(rows.map(r => r.actor_id).filter(Boolean))];
      const users = await User.findAll({
        where: { id: actorIds },
        attributes: ['id', 'first_name', 'last_name']
      });
      const nameMap = Object.fromEntries(
        users.map(u => [String(u.id), `${u.first_name} ${u.last_name}`.trim()])
      );

      const result = {};
      for (const action of actions) {
        const row = rows.find(r => r.action === action);
        result[action] = row ? (nameMap[String(row.actor_id)] ?? null) : null;
      }
      return result;
    } catch (error) {
      console.error('Error in getActorsByActions:', error);
      throw error;
    }
  }
}

module.exports = AuditService;
