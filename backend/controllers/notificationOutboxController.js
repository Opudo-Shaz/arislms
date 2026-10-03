const notificationOutboxService = require('../services/notificationOutboxService');
const logger = require('../config/logger');
const { parseKeysetQuery, toPaginationDto } = require('../utils/keysetPagination');

const notificationOutboxController = {
  async getAll(req, res) {
    try {
      const { cursor, direction, limit } = parseKeysetQuery(req.query);
      const { status, channel, eventKey } = req.query;
      const result = await notificationOutboxService.getAll({ status, channel, eventKey, cursor, direction, limit });
      return res.status(200).json({ success: true, data: result.rows, pagination: toPaginationDto(result) });
    } catch (error) {
      logger.error(`Error fetching notification outbox: ${error.message}`);
      return res.status(error.statusCode === 400 ? 400 : 500).json({ success: false, message: error.message });
    }
  },

  async getById(req, res) {
    try {
      const row = await notificationOutboxService.getById(req.params.id);
      return res.status(200).json({ success: true, data: row });
    } catch (error) {
      const status = error.message === 'Outbox entry not found' ? 404 : 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  },

  async retry(req, res) {
    try {
      const row = await notificationOutboxService.retry(req.params.id);
      return res.status(200).json({ success: true, message: 'Outbox entry re-queued', data: row });
    } catch (error) {
      const status = error.message === 'Outbox entry not found' ? 404 : 400;
      return res.status(status).json({ success: false, message: error.message });
    }
  },
};

module.exports = notificationOutboxController;
