const AuditService = require('../services/auditService');

/**
 * Audit logging helper to record entity changes
 */
class AuditLogger {
  /**
   * Log a CREATE action
   * @param {string} entityType - Type of entity (e.g., 'USER', 'LOAN')
   * @param {string} entityId - ID of the created entity
   * @param {Object} data - The created data
   * @param {string} actorId - ID of the user who performed the action
   * @param {Object} options - Additional options
   */
  static async logCreate(entityType, entityId, data, actorId, options = {}) {
    try {
      await AuditService.logAction({
        entityType,
        entityId,
        action: 'CREATE',
        commandAsJson: data,
        actorId,
        actorType: options.actorType || 'USER',
        correlationId: options.correlationId,
        source: options.source,
      });
    } catch (error) {
      console.error(`Error logging CREATE audit for ${entityType}:`, error);
    }
  }

  /**
   * Log an UPDATE action
   * @param {string} entityType - Type of entity
   * @param {string} entityId - ID of the updated entity
   * @param {Object} changes - The changes made
   * @param {string} actorId - ID of the user who performed the action
   * @param {Object} options - Additional options
   */
  static async logUpdate(entityType, entityId, changes, actorId, options = {}) {
    try {
      await AuditService.logAction({
        entityType,
        entityId,
        action: 'UPDATE',
        commandAsJson: changes,
        actorId,
        actorType: options.actorType || 'USER',
        correlationId: options.correlationId,
        source: options.source,
      });
    } catch (error) {
      console.error(`Error logging UPDATE audit for ${entityType}:`, error);
    }
  }

  /**
   * Log a DELETE action
   * @param {string} entityType - Type of entity
   * @param {string} entityId - ID of the deleted entity
   * @param {Object} deletedData - The deleted data (for record-keeping)
   * @param {string} actorId - ID of the user who performed the action
   * @param {Object} options - Additional options
   */
  static async logDelete(entityType, entityId, deletedData, actorId, options = {}) {
    try {
      await AuditService.logAction({
        entityType,
        entityId,
        action: 'DELETE',
        commandAsJson: deletedData,
        actorId,
        actorType: options.actorType || 'USER',
        correlationId: options.correlationId,
        source: options.source,
      });
    } catch (error) {
      console.error(`Error logging DELETE audit for ${entityType}:`, error);
    }
  }
}

module.exports = AuditLogger;
