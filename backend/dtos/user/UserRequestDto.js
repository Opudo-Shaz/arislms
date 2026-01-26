const Joi = require('joi');

class UserRequestDto {
  constructor(data) {
    this.name = data.name;
    this.email = data.email;
    this.phone = data.phone;
    this.roleId = data.roleId;
    this.group_code = data.group_code;
    this.password = data.password;   
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

    roleId: Joi.number().integer().required()
      .messages({
        'any.required': 'Role ID is required',
        'number.base': 'Role ID must be a number'
      }),

    group_code: Joi.string().max(50).allow(null, '')
      .messages({
        'string.max': 'Group code cannot exceed 50 characters'
      }),

    // ✅ Password validation, should include characters, numbers, etc., special chars
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).*$/)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters',
        'any.required': 'Password is required'
      })
  });

  // Joi validation schema for updating users
  static updateSchema = UserRequestDto.createSchema.fork(
    ['name', 'email', 'roleId', 'password'],   
    (schema) => schema.optional()
  );
}

module.exports = UserRequestDto;
