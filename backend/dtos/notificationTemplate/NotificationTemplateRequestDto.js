const Joi = require('joi');

class NotificationTemplateRequestDto {
  constructor(data) {
    this.eventKey = data.eventKey;
    this.description = data.description;
    this.emailSubject = data.emailSubject;
    this.emailBody = data.emailBody;
    this.smsBody = data.smsBody;
    this.pushTitle = data.pushTitle;
    this.pushBody = data.pushBody;
    this.inAppTitle = data.inAppTitle;
    this.inAppBody = data.inAppBody;
    this.emailEnabled = data.emailEnabled;
    this.smsEnabled = data.smsEnabled;
    this.pushEnabled = data.pushEnabled;
    this.inAppEnabled = data.inAppEnabled;
    this.isActive = data.isActive;
  }

  static createSchema = Joi.object({
    eventKey: Joi.string().trim().lowercase().min(2).max(64).pattern(/^[a-z0-9_]+$/).required()
      .messages({
        'string.empty': 'Event key is required',
        'string.pattern.base': 'Event key may only contain lowercase letters, numbers and underscores',
        'any.required': 'Event key is required',
      }),
    description: Joi.string().trim().max(500).allow(null, '').optional(),
    emailSubject: Joi.string().trim().max(255).allow(null, '').optional(),
    emailBody: Joi.string().allow(null, '').optional(),
    smsBody: Joi.string().allow(null, '').optional(),
    pushTitle: Joi.string().trim().max(150).allow(null, '').optional(),
    pushBody: Joi.string().allow(null, '').optional(),
    inAppTitle: Joi.string().trim().max(150).allow(null, '').optional(),
    inAppBody: Joi.string().allow(null, '').optional(),
    emailEnabled: Joi.boolean().default(true),
    smsEnabled: Joi.boolean().default(true),
    pushEnabled: Joi.boolean().default(true),
    inAppEnabled: Joi.boolean().default(true),
    isActive: Joi.boolean().default(true),
  });

  static updateSchema = NotificationTemplateRequestDto.createSchema.fork(
    ['eventKey'],
    (schema) => schema.optional()
  );
}

module.exports = NotificationTemplateRequestDto;
