const notificationService = require('../services/notificationService');
const logger = require('../config/logger');

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
      const notification = await notificationService.markAsRead(req.params.id, req.user.id);
      res.status(200).json({ success: true, data: notification });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },
};

module.exports = notificationController;
