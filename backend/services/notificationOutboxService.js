const { Op } = require('sequelize');
const NotificationOutbox = require('../models/notificationOutboxModel');
const NotificationDeliveryStatus = require('../enums/notificationDeliveryStatus');
const logger = require('../config/logger');

const notificationOutboxService = {
  async getAll({ status, channel, eventKey, page = 1, limit = 20 } = {}) {
    try {
      const where = {};
      if (status) where.status = status;
      if (channel) where.channel = channel;
      if (eventKey) where.eventKey = eventKey;

      const offset = (page - 1) * limit;
      const { count, rows } = await NotificationOutbox.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit,
        offset,
      });
      return { total: count, page, limit, data: rows };
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
