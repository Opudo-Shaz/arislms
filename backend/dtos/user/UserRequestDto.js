// dtos/user/UserRequestDTO.js
const Joi = require('joi');

class UserRequestDto {
  constructor(data) {
    this.name = data.name;
    this.email = data.email;
    this.phone = data.phone;
    this.role = data.role;
    this.group_code = data.group_code;
  }

  // Joi validation schema for creating users
  static createSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required()
      .messages({
        'string.empty': 'Name is required',
        'string.min': 'Name must be at least 2 characters',
        'string.max': 'Name cannot exceed 100 characters',
        'any.required': 'Name is required'
      }),
    email: Joi.string().email().required()
      .messages({
        'string.email': 'Email must be a valid email address',
        'any.required': 'Email is required'
      }),
    phone: Joi.string().pattern(/^\d{7,}$/).allow(null, '')
      .messages({
        'string.pattern.base': 'Phone must contain at least 7 digits'
      }),
    role: Joi.string().valid('admin', 'user', 'officer').required()
      .messages({
        'any.only': 'Role must be admin, user, or officer',
        'any.required': 'Role is required'
      }),
    group_code: Joi.string().max(50).allow(null, '')
      .messages({
        'string.max': 'Group code cannot exceed 50 characters'
      })
  });

  // Joi validation schema for updating users
  static updateSchema = UserRequestDto.createSchema.fork(
    ['name', 'email', 'role'],
    (schema) => schema.optional()
  );
}

module.exports = UserRequestDto;
