const notificationService = require('../services/notificationService');
const logger = require('../config/logger');
const { getUserId } = require('../utils/helpers');

const notificationController = {
  async getMyNotifications(req, res) {
    try {
      const notifications = await notificationService.getUserNotifications(req.user.id);
      res.status(200).json({ success: true, data: notifications });
    } catch (error) {
      logger.error(error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async markNotificationRead(req, res) {
    try {
      const userId = getUserId(req);
      const userAgent = req.headers['user-agent'];

      const notification = await notificationService.markAsRead(req.params.id, req.user.id, userId, userAgent);
      res.status(200).json({ success: true, data: notification });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async deleteNotification(req, res) {
    try {
      const userId = getUserId(req);
      const userAgent = req.headers['user-agent'];

      const result = await notificationService.deleteNotification(req.params.id, userId, userAgent);
      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      logger.error(`Error deleting notification: ${error.message}`);
      res.status(400).json({ success: false, message: error.message });
    }
  },
};

module.exports = notificationController;
