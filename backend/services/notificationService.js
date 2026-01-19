const Notification = require('../models/notificationModel');
const logger = require('../config/logger');
const AuditLogger = require('../utils/auditLogger');

const notificationService = {
  async createNotification(data, creatorId = null, userAgent = 'unknown') {
    try {
      const notification = await Notification.create(data);

      // Log to audit table after successful creation
      await AuditLogger.log({
        entityType: 'NOTIFICATION',
        entityId: notification.id,
        action: 'CREATE',
        data,
        actorId: creatorId || 'system',
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

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

  async markAsRead(id, userId, updatorId = null, userAgent = 'unknown') {
    try {
      const notification = await Notification.findOne({ where: { id, userId } });
      if (!notification) throw new Error('Notification not found');
      
      notification.isRead = true;
      await notification.save();

      // Log to audit table after successful update
      await AuditLogger.log({
        entityType: 'NOTIFICATION',
        entityId: id,
        action: 'UPDATE',
        data: { isRead: true },
        actorId: updatorId || 'system',
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      return notification;
    } catch (error) {
      logger.error(`Error marking notification as read: ${error.message}`);
      throw error;
    }
  },

  async deleteNotification(id, deletorId = null, userAgent = 'unknown') {
    try {
      const notification = await Notification.findByPk(id);
      if (!notification) throw new Error('Notification not found');

      const deletedData = notification.toJSON();
      await notification.destroy();

      // Log to audit table after successful deletion
      await AuditLogger.log({
        entityType: 'NOTIFICATION',
        entityId: id,
        action: 'DELETE',
        data: deletedData,
        actorId: deletorId || 'system',
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      logger.info(`Notification ${id} deleted by user ${deletorId}`);
      return { message: 'Notification deleted successfully' };
    } catch (error) {
      logger.error(`Error deleting notification: ${error.message}`);
      throw error;
    }
  },
};

module.exports = notificationService;
