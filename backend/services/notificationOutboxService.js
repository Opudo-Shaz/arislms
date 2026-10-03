const { Op } = require('sequelize');
const NotificationOutbox = require('../models/notificationOutboxModel');
const NotificationDeliveryStatus = require('../enums/notificationDeliveryStatus');
const logger = require('../config/logger');
const { paginateKeyset } = require('../utils/keysetPagination');

const notificationOutboxService = {
  async getAll({ status, channel, eventKey, cursor, direction, limit = 20 } = {}) {
    try {
      const where = {};
      if (status) where.status = status;
      if (channel) where.channel = channel;
      if (eventKey) where.eventKey = eventKey;

      return await paginateKeyset(NotificationOutbox, {
        keys: [['created_at', 'timestamp'], ['id', 'int']],
        cursor,
        direction,
        limit,
        where,
      });
    } catch (error) {
      logger.error(`notificationOutboxService.getAll Error: ${error.message}`);
      throw error;
    }
  },

  async getById(id) {
    try {
      const row = await NotificationOutbox.findByPk(id);
      if (!row) throw new Error('Outbox entry not found');
      return row;
    } catch (error) {
      logger.error(`notificationOutboxService.getById Error: ${error.message}`);
      throw error;
    }
  },

  /** Re-queues a FAILED (or SKIPPED) row for immediate pickup by the next outbox worker tick. */
  async retry(id) {
    try {
      const row = await NotificationOutbox.findByPk(id);
      if (!row) throw new Error('Outbox entry not found');

      if (![NotificationDeliveryStatus.FAILED, NotificationDeliveryStatus.SKIPPED].includes(row.status)) {
        throw new Error(`Only FAILED or SKIPPED entries can be retried. Current status: ${row.status}`);
      }

      await row.update({
        status: NotificationDeliveryStatus.QUEUED,
        nextAttemptAt: null,
        lastError: null,
      });
      return row;
    } catch (error) {
      logger.error(`notificationOutboxService.retry Error: ${error.message}`);
      throw error;
    }
  },
};

module.exports = notificationOutboxService;
