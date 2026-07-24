const Joi = require('joi');

class CodeRequestDto {
  constructor(data) {
    this.key = data.key;
    this.name = data.name;
    this.description = data.description;
    this.isActive = data.isActive;
  }

  // Joi validation schema for creating a code
  static createSchema = Joi.object({
    key: Joi.string().trim().uppercase().min(2).max(64).pattern(/^[A-Z0-9_]+$/).required()
      .messages({
        'string.empty': 'Key is required',
        'string.min': 'Key must be at least 2 characters',
        'string.max': 'Key cannot exceed 64 characters',
        'string.pattern.base': 'Key may only contain uppercase letters, numbers and underscores',
        'any.required': 'Key is required',
      }),
    name: Joi.string().trim().min(2).max(120).required()
      .messages({
        'string.empty': 'Name is required',
        'string.min': 'Name must be at least 2 characters',
        'string.max': 'Name cannot exceed 120 characters',
        'any.required': 'Name is required',
      }),
    description: Joi.string().trim().max(500).allow(null, '').optional(),
    isActive: Joi.boolean().default(true),
  });

  // Joi validation schema for updating a code (key is immutable)
  static updateSchema = Joi.object({
    name: Joi.string().trim().min(2).max(120).optional(),
    description: Joi.string().trim().max(500).allow(null, '').optional(),
    isActive: Joi.boolean().optional(),
  });
}

module.exports = CodeRequestDto;
