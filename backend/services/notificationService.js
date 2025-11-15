const Notification = require('../models/notificationModel');
const logger = require('../config/logger');

const notificationService = {
  async createNotification(data) {
    try {
      const notification = await Notification.create(data);
      logger.info(`Notification created for user ${data.userId}: ${data.title}`);
      return notification;
    } catch (error) {
      logger.error(`Error creating notification: ${error.message}`);
      throw error;
    }
  },

  async getUserNotifications(userId) {
    try {
      return await Notification.findAll({ 
        where: { userId }, 
        order: [['created_at', 'DESC']] 
      });
    } catch (error) {
      logger.error(`Error fetching notifications for user ${userId}: ${error.message}`);
      throw error;
    }
  },

  async markAsRead(id, userId) {
    try {
      const notification = await Notification.findOne({ where: { id, userId } });
      if (!notification) throw new Error('Notification not found');
      notification.isRead = true;
      await notification.save();
      return notification;
    } catch (error) {
      logger.error(`Error marking notification as read: ${error.message}`);
      throw error;
    }
  },
};

module.exports = notificationService;
