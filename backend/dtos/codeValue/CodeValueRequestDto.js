const Joi = require('joi');

class CodeValueRequestDto {
  constructor(data) {
    this.value = data.value;
    this.description = data.description;
    this.sortOrder = data.sortOrder;
    this.isActive = data.isActive;
  }

  // Joi validation schema for creating a code value
  static createSchema = Joi.object({
    value: Joi.string().trim().min(1).max(120).required()
      .messages({
        'string.empty': 'Value is required',
        'string.max': 'Value cannot exceed 120 characters',
        'any.required': 'Value is required',
      }),
    description: Joi.string().trim().max(500).allow(null, '').optional(),
    sortOrder: Joi.number().integer().default(0),
    isActive: Joi.boolean().default(true),
  });

  // Joi validation schema for updating a code value
  static updateSchema = Joi.object({
    value: Joi.string().trim().min(1).max(120).optional(),
    description: Joi.string().trim().max(500).allow(null, '').optional(),
    sortOrder: Joi.number().integer().optional(),
    isActive: Joi.boolean().optional(),
  });
}

module.exports = CodeValueRequestDto;
