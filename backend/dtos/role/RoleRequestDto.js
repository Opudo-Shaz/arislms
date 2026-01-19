const Joi = require('joi');

class RoleRequestDto {
  constructor(data) {
    this.name = data.name;
    this.description = data.description;
    this.permissions = data.permissions;
    this.isActive = data.isActive;
  }

  // Joi validation schema for creating roles
  static createSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required()
      .messages({
        'string.empty': 'Role name is required',
        'string.min': 'Role name must be at least 2 characters',
        'string.max': 'Role name cannot exceed 100 characters',
        'any.required': 'Role name is required'
      }),
    description: Joi.string().trim().max(500).allow(null).optional()
      .messages({
        'string.max': 'Description cannot exceed 500 characters'
      }),
    permissions: Joi.array().items(Joi.string()).allow(null).default([])
      .messages({
        'array.base': 'Permissions must be an array'
      }),
    isActive: Joi.boolean().default(true)
      .messages({
        'boolean.base': 'isActive must be a boolean'
      })
  });

  // Joi validation schema for updating roles
  static updateSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).optional()
      .messages({
        'string.min': 'Role name must be at least 2 characters',
        'string.max': 'Role name cannot exceed 100 characters'
      }),
    description: Joi.string().trim().max(500).allow(null).optional()
      .messages({
        'string.max': 'Description cannot exceed 500 characters'
      }),
    permissions: Joi.array().items(Joi.string()).allow(null).optional()
      .messages({
        'array.base': 'Permissions must be an array'
      }),
    isActive: Joi.boolean().optional()
      .messages({
        'boolean.base': 'isActive must be a boolean'
      })
  });
}

module.exports = RoleRequestDto;
