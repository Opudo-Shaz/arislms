const { Op } = require('sequelize');
const AuditLog = require('../models/auditLogModel');
const User = require('../models/userModel');
const Client = require('../models/clientModel');
const { paginateKeyset } = require('../utils/keysetPagination');

// actor_id is only meaningful together with actor_type: USER ids point at
// `users`, CLIENT ids at `clients` (portal actions), and SYSTEM/SERVICE ids
// aren't people. The `actor` association joins users unconditionally, so
// resolve actors per type afterwards instead of trusting the join.
const userActorInclude = { model: User, as: 'actor', attributes: ['id', 'first_name', 'last_name'], required: false };

/**
 * Replace each row's `actor` with the right person for its actor_type
 * (same `{ id, first_name, last_name }` shape, plus `type`), or null.
 * @param {Array} rows - AuditLog instances loaded with userActorInclude
 */
async function resolveActors(rows) {
  const clientIds = [...new Set(rows.filter((r) => r.actor_type === 'CLIENT').map((r) => r.actor_id))];
  const clients = clientIds.length
    ? await Client.findAll({ where: { id: clientIds }, attributes: ['id', 'firstName', 'lastName'] })
    : [];
  const clientMap = new Map(clients.map((c) => [String(c.id), c]));

  for (const row of rows) {
    let actor = null;
    if (row.actor_type === 'USER') {
      const u = row.actor;
      actor = u ? { id: u.id, first_name: u.first_name, last_name: u.last_name, type: 'USER' } : null;
    } else if (row.actor_type === 'CLIENT') {
      const c = clientMap.get(String(row.actor_id));
      actor = c ? { id: c.id, first_name: c.firstName, last_name: c.lastName, type: 'CLIENT' } : null;
    }
    // Both: dataValues drives toJSON (API responses); the instance property is
    // what Sequelize set from the include and what server-side callers read.
    row.setDataValue('actor', actor);
    row.actor = actor;
  }
  return rows;
}

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
        include: [userActorInclude],
        limit,
        offset,
        order: [['occurred_at', order]],
      });
      return resolveActors(logs);
    } catch (error) {
      console.error('Error retrieving audit logs:', error);
      throw error;
    }
  }

  /**
   * Get audit logs for a specific actor. Actor ids are only unique within an
   * actor type (user #5 and client #5 are different people), so the type is
   * part of the filter.
   * @param {string} actorId - ID of the actor
   * @param {Object} options - Query options
   * @param {string} [options.actorType='USER'] - USER | CLIENT | SERVICE | SYSTEM
   * @returns {Promise<Array>} Audit log records
   */
  static async getAuditsByActor(actorId, options = {}) {
    try {
      const { limit = 100, offset = 0, order = 'DESC', actorType = 'USER' } = options;
      const logs = await AuditLog.findAll({
        where: {
          actor_id: actorId,
          actor_type: String(actorType).toUpperCase(),
        },
        include: [userActorInclude],
        limit,
        offset,
        order: [['occurred_at', order]],
      });
      return resolveActors(logs);
    } catch (error) {
      console.error('Error retrieving audit logs by actor:', error);
      throw error;
    }
  }

  /**
   * Get audit logs (keyset paginated, newest first) with optional filtering
   * @param {Object} filters - Filter criteria
   * @param {Object} options - { cursor, direction, limit }
   * @returns {Promise<Object>} { rows, limit, hasNext, hasPrev, nextCursor, prevCursor }
   */
  static async getAuditLogs(filters = {}, options = {}) {
    try {
      const { cursor, direction, limit = 100 } = options;
      const where = {};

      if (filters.entityType) where.entity_type = filters.entityType;
      if (filters.action) where.action = filters.action.toUpperCase();
      if (filters.actorType) where.actor_type = filters.actorType.toUpperCase();
      if (filters.startDate || filters.endDate) {
        where.occurred_at = {
          ...(filters.startDate ? { [Op.gte]: filters.startDate } : {}),
          ...(filters.endDate ? { [Op.lte]: filters.endDate } : {}),
        };
      }

      const result = await paginateKeyset(AuditLog, {
        keys: [['occurred_at', 'timestamp'], ['audit_id', 'int']],
        cursor,
        direction,
        limit,
        where,
        include: [userActorInclude],
      });
      await resolveActors(result.rows);
      return result;
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

      const idsOfType = (type) => [...new Set(rows.filter(r => r.actor_type === type).map(r => r.actor_id).filter(Boolean))];
      const userIds = idsOfType('USER');
      const clientIds = idsOfType('CLIENT');
      const [users, clients] = await Promise.all([
        userIds.length ? User.findAll({ where: { id: userIds }, attributes: ['id', 'first_name', 'last_name'] }) : [],
        clientIds.length ? Client.findAll({ where: { id: clientIds }, attributes: ['id', 'firstName', 'lastName'] }) : [],
      ]);
      const nameMap = {
        ...Object.fromEntries(users.map(u => [`USER:${u.id}`, `${u.first_name} ${u.last_name}`.trim()])),
        ...Object.fromEntries(clients.map(c => [`CLIENT:${c.id}`, `${c.firstName} ${c.lastName}`.trim()])),
      };

      const result = {};
      for (const action of actions) {
        const row = rows.find(r => r.action === action);
        result[action] = row ? (nameMap[`${row.actor_type}:${row.actor_id}`] ?? null) : null;
      }
      return result;
    } catch (error) {
      console.error('Error in getActorsByActions:', error);
      throw error;
    }
  }
}

module.exports = AuditService;
