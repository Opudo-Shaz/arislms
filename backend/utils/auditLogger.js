const AuditService = require('../services/auditService');

const SYSTEM_USER_ID = 1;

class AuditLogger {
  static async log({
    entityType,
    entityId,
    action,
    data,
    actorId,
    options = {},
  }) {
    try {
      if (!entityType || !entityId || !action || !actorId) {
        throw new Error('Missing required audit log parameters');
      }

      const allowedActions = [
        'CREATE', 'UPDATE', 'DELETE', 'UPDATE_PRINCIPAL', 'DISBURSE', 'REVERSE',
        'KYC_VERIFY', 'KYC_REQUEST_INFO', 'KYC_REJECT',
        'ACTIVATE', 'DEACTIVATE', 'SUSPEND', 'BLACKLIST'
      ];
      if (!allowedActions.includes(action)) {
        throw new Error(`Invalid audit action: ${action}`);
      }

      await AuditService.logAction({
        entityType,
        entityId,
        action,
        commandAsJson: data,
        actorId,
        actorType: options.actorType || 'USER',
        correlationId: options.correlationId,
        source: options.source,
      });
    } catch (error) {
      console.error(
        `Error logging ${action} audit for ${entityType}:`,
        error
      );
    }
  }
}

AuditLogger.SYSTEM_USER_ID = SYSTEM_USER_ID;

module.exports = AuditLogger;
