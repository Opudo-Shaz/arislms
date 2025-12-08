const Joi = require('joi');

class ClientRequestDTO {
  constructor(data) {
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.email = data.email;
    this.phone = data.phone;
    this.secondaryPhone = data.secondaryPhone;
    this.dateOfBirth = data.dateOfBirth;
    this.gender = data.gender;
    this.occupation = data.occupation;
    this.employer = data.employer;
    this.monthlyIncome = data.monthlyIncome;
    this.address = data.address;
    this.preferredContactMethod = data.preferredContactMethod;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.status = data.status || 'active';
  }

  // Joi validation schema for creating clients
  static createSchema = Joi.object({
    firstName: Joi.string().trim().min(2).max(100).required()
      .messages({
        'string.empty': 'First name is required',
        'string.min': 'First name must be at least 2 characters',
        'string.max': 'First name cannot exceed 100 characters',
        'any.required': 'First name is required'
      }),
    lastName: Joi.string().trim().min(2).max(100).required()
      .messages({
        'string.empty': 'Last name is required',
        'string.min': 'Last name must be at least 2 characters',
        'string.max': 'Last name cannot exceed 100 characters',
        'any.required': 'Last name is required'
      }),
    email: Joi.string().email().required()
      .messages({
        'string.email': 'Email must be a valid email address',
        'any.required': 'Email is required'
      }),
    phone: Joi.string().pattern(/^\d{7,}$/).required()
      .messages({
        'string.pattern.base': 'Phone must contain at least 7 digits',
        'any.required': 'Phone is required'
      }),
    secondaryPhone: Joi.string().pattern(/^\d{7,}$/).allow(null, '')
      .messages({
        'string.pattern.base': 'Secondary phone must contain at least 7 digits'
      }),
    dateOfBirth: Joi.date().iso().allow(null, '')
      .messages({
        'date.base': 'Date of birth must be a valid date'
      }),
    gender: Joi.string().valid('Male', 'Female', 'Other').allow(null, '')
      .messages({
        'any.only': 'Gender must be Male, Female, or Other'
      }),
    occupation: Joi.string().max(128).allow(null, '')
      .messages({
        'string.max': 'Occupation cannot exceed 128 characters'
      }),
    employer: Joi.string().max(128).allow(null, '')
      .messages({
        'string.max': 'Employer cannot exceed 128 characters'
      }),
    monthlyIncome: Joi.number().min(0).allow(null, '')
      .messages({
        'number.base': 'Monthly income must be a number',
        'number.min': 'Monthly income cannot be negative'
      }),
    address: Joi.object().allow(null, '')
      .messages({
        'object.base': 'Address must be an object'
      }),
    preferredContactMethod: Joi.string().valid('email', 'phone', 'sms').allow(null, '')
      .messages({
        'any.only': 'Preferred contact method must be email, phone, or sms'
      }),
    isActive: Joi.boolean().default(true),
    status: Joi.string().valid('active', 'inactive', 'suspended', 'blacklisted').default('active')
      .messages({
        'any.only': 'Status must be active, inactive, suspended, or blacklisted'
      })
  });

  // Joi validation schema for updating clients
  static updateSchema = ClientRequestDTO.createSchema.fork(
    ['firstName', 'lastName', 'email', 'phone'],
    (schema) => schema.optional()
  );
}

module.exports = ClientRequestDTO;
