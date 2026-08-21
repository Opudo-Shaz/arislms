const NotificationTemplate = require('../models/notificationTemplateModel');
const AuditLogger = require('../utils/auditLogger');
const logger = require('../config/logger');

const notificationTemplateService = {
  async createTemplate(data, creatorId = null, userAgent = 'unknown') {
    try {
      const existing = await NotificationTemplate.findOne({ where: { eventKey: data.eventKey } });
      if (existing) throw new Error(`Template for eventKey '${data.eventKey}' already exists`);

      const template = await NotificationTemplate.create({ ...data, createdBy: creatorId });

      await AuditLogger.log({
        entityType: 'NOTIFICATION_TEMPLATE',
        entityId: template.id,
        action: 'CREATE',
        data,
        actorId: creatorId || 1,
        options: { actorType: 'USER', source: userAgent },
      });

      return template;
    } catch (error) {
      logger.error(`notificationTemplateService.createTemplate Error: ${error.message}`);
      throw error;
    }
  },

  async getAllTemplates() {
    try {
      return await NotificationTemplate.findAll({ order: [['event_key', 'ASC']] });
    } catch (error) {
      logger.error(`notificationTemplateService.getAllTemplates Error: ${error.message}`);
      throw error;
    }
  },

  async getTemplateById(id) {
    try {
      const template = await NotificationTemplate.findByPk(id);
      if (!template) throw new Error('Notification template not found');
      return template;
    } catch (error) {
      logger.error(`notificationTemplateService.getTemplateById Error: ${error.message}`);
      throw error;
    }
  },

  async updateTemplate(id, data, updatorId = null, userAgent = 'unknown') {
    try {
      const template = await NotificationTemplate.findByPk(id);
      if (!template) throw new Error('Notification template not found');

      await template.update({ ...data, modifiedBy: updatorId });

      await AuditLogger.log({
        entityType: 'NOTIFICATION_TEMPLATE',
        entityId: id,
        action: 'UPDATE',
        data,
        actorId: updatorId || 1,
        options: { actorType: 'USER', source: userAgent },
      });

      return template;
    } catch (error) {
      logger.error(`notificationTemplateService.updateTemplate Error: ${error.message}`);
      throw error;
    }
  },

  async deleteTemplate(id, deletorId = null, userAgent = 'unknown') {
    try {
      const template = await NotificationTemplate.findByPk(id);
      if (!template) throw new Error('Notification template not found');

      const deletedData = template.toJSON();
      await template.destroy();

      await AuditLogger.log({
        entityType: 'NOTIFICATION_TEMPLATE',
        entityId: id,
        action: 'DELETE',
        data: deletedData,
        actorId: deletorId || 1,
        options: { actorType: 'USER', source: userAgent },
      });

      return { message: 'Notification template deleted successfully' };
    } catch (error) {
      logger.error(`notificationTemplateService.deleteTemplate Error: ${error.message}`);
      throw error;
    }
  },
};

module.exports = notificationTemplateService;
