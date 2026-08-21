const notificationOutboxService = require('../services/notificationOutboxService');
const logger = require('../config/logger');

const notificationOutboxController = {
  async getAll(req, res) {
    try {
      const { status, channel, eventKey, page, limit } = req.query;
      const result = await notificationOutboxService.getAll({
        status,
        channel,
        eventKey,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      logger.error(`Error fetching notification outbox: ${error.message}`);
      return res.status(500).json({ success: false, message: error.message });
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
