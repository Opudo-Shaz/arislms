const notificationTemplateService = require('../services/notificationTemplateService');
const { NotificationTemplateRequestDto, NotificationTemplateResponseDto } = require('../dtos/notificationTemplate');
const logger = require('../config/logger');

const notificationTemplateController = {
  async createTemplate(req, res) {
    try {
      const { error, value } = NotificationTemplateRequestDto.createSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          error: error.details.map((d) => d.message),
        });
      }

      const userId = req.user?.id || null;
      const userAgent = req.headers['user-agent'] || 'unknown';

      const template = await notificationTemplateService.createTemplate(value, userId, userAgent);
      return res.status(201).json({
        success: true,
        message: 'Notification template created successfully',
        data: NotificationTemplateResponseDto.fromModel(template),
      });
    } catch (error) {
      logger.error(`Error creating notification template: ${error.message}`);
      const status = error.message.includes('already exists') ? 409 : 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  },

  async getAllTemplates(req, res) {
    try {
      const templates = await notificationTemplateService.getAllTemplates();
      return res.status(200).json({ success: true, data: NotificationTemplateResponseDto.fromModels(templates) });
    } catch (error) {
      logger.error(`Error fetching notification templates: ${error.message}`);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  async getTemplateById(req, res) {
    try {
      const template = await notificationTemplateService.getTemplateById(req.params.id);
      return res.status(200).json({ success: true, data: NotificationTemplateResponseDto.fromModel(template) });
    } catch (error) {
      const status = error.message === 'Notification template not found' ? 404 : 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  },

  async updateTemplate(req, res) {
    try {
      const { error, value } = NotificationTemplateRequestDto.updateSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          error: error.details.map((d) => d.message),
        });
      }

      const userId = req.user?.id || null;
      const userAgent = req.headers['user-agent'] || 'unknown';

      const template = await notificationTemplateService.updateTemplate(req.params.id, value, userId, userAgent);
      return res.status(200).json({
        success: true,
        message: 'Notification template updated successfully',
        data: NotificationTemplateResponseDto.fromModel(template),
      });
    } catch (error) {
      const status = error.message === 'Notification template not found' ? 404 : 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  },

  async deleteTemplate(req, res) {
    try {
      const userId = req.user?.id || null;
      const userAgent = req.headers['user-agent'] || 'unknown';

      const result = await notificationTemplateService.deleteTemplate(req.params.id, userId, userAgent);
      return res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      const status = error.message === 'Notification template not found' ? 404 : 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  },
};

module.exports = notificationTemplateController;
