const Joi = require('joi');
const j2s = require('joi-to-swagger');

class UserRequestDto {
  constructor(data) {
    this.first_name = data.first_name;
    this.middle_name = data.middle_name;
    this.last_name = data.last_name;
    this.email = data.email;
    this.phone = data.phone;
    this.roleId = data.roleId;
    this.id_number = data.id_number;
    this.password = data.password;
  }

  // Joi validation schema for creating users
  static createSchema = Joi.object({
    first_name: Joi.string().trim().min(2).max(100).required()
      .example('Alice')
      .messages({
        'string.empty': 'First name is required',
        'string.min': 'First name must be at least 2 characters',
        'string.max': 'First name cannot exceed 100 characters',
        'any.required': 'First name is required'
      }),

    middle_name: Joi.string().trim().min(2).max(100).allow(null, '')
      .example('Marie')
      .messages({
        'string.min': 'Middle name must be at least 2 characters',
        'string.max': 'Middle name cannot exceed 100 characters'
      }),

    last_name: Joi.string().trim().min(2).max(100).required()
      .example('Smith')
      .messages({
        'string.empty': 'Last name is required',
        'string.min': 'Last name must be at least 2 characters',
        'string.max': 'Last name cannot exceed 100 characters',
        'any.required': 'Last name is required'
      }),

    email: Joi.string().email().required()
      .example('alice@test.com')
      .messages({
        'string.email': 'Email must be a valid email address',
        'any.required': 'Email is required'
      }),

    phone: Joi.string().pattern(/^\d{7,}$/).allow(null, '')
      .example('1234567')
      .messages({
        'string.pattern.base': 'Phone must contain at least 7 digits'
      }),

    roleId: Joi.number().integer().required()
      .example(1)
      .messages({
        'any.required': 'Role ID is required',
        'number.base': 'Role ID must be a number'
      }),

    id_number: Joi.string().trim().min(4).max(50).required()
      .example('ID1234')
      .messages({
        'string.empty': 'ID number is required',
        'any.required': 'ID number is required'
      }),

    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).*$/)
      .required()
      .example('Password123!')
      .messages({
        'string.min': 'Password must be at least 8 characters',
        'any.required': 'Password is required'
      })
  });

  // Joi validation schema for updating users
  static updateSchema = Joi.object({
    first_name: Joi.string().trim().min(2).max(100).optional()
      .example('Alice')
      .messages({
        'string.min': 'First name must be at least 2 characters',
        'string.max': 'First name cannot exceed 100 characters'
      }),

    middle_name: Joi.string().trim().min(2).max(100).allow(null, '').optional()
      .example('Marie')
      .messages({
        'string.min': 'Middle name must be at least 2 characters',
        'string.max': 'Middle name cannot exceed 100 characters'
      }),

    last_name: Joi.string().trim().min(2).max(100).optional()
      .example('Johnson')
      .messages({
        'string.min': 'Last name must be at least 2 characters',
        'string.max': 'Last name cannot exceed 100 characters'
      }),

    email: Joi.string().email().optional()
      .example('alice.updated@test.com')
      .messages({
        'string.email': 'Email must be a valid email address'
      }),

    phone: Joi.string().pattern(/^\d{7,}$/).allow(null, '').optional()
      .example('9876543')
      .messages({
        'string.pattern.base': 'Phone must contain at least 7 digits'
      }),

    roleId: Joi.number().integer().optional()
      .example(2)
      .messages({
        'number.base': 'Role ID must be a number'
      }),

    id_number: Joi.string().trim().min(4).max(50).optional()
      .example('ID5678')
      .messages({
        'string.min': 'ID number must be at least 4 characters'
      }),

    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).*$/)
      .optional()
      .example('NewPassword456!')
      .messages({
        'string.min': 'Password must be at least 8 characters'
      })
  });

  // Generate OpenAPI schema from Joi
  static getSwaggerSchema(create = true) {
    const { swagger } = j2s(create ? this.createSchema : this.updateSchema);
    return swagger;
  }

  // Get both schemas with examples
  static getSwaggerDefinitions() {
    const createResult = j2s(this.createSchema);
    const updateResult = j2s(this.updateSchema);
    
    return {
      UserCreate: createResult.swagger,
      UserUpdate: updateResult.swagger
    };
  }

  // Helper to get example objects
  static getExamples() {
    return {
      create: {
        first_name: 'Alice',
        middle_name: 'Marie',
        last_name: 'Smith',
        email: 'alice@test.com',
        phone: '1234567',
        roleId: 1,
        id_number: 'ID1234',
        password: 'Password123!'
      },
      updateFull: {
        first_name: 'Alice',
        middle_name: 'Anne',
        last_name: 'Johnson',
        email: 'alice.updated@test.com',
        phone: '9876543',
        roleId: 2,
        id_number: 'ID5678',
        password: 'NewPassword456!'
      },
      updatePartial: {
        first_name: 'Alice',
        last_name: 'Smith'
      }
    };
  }
}

module.exports = UserRequestDto;
