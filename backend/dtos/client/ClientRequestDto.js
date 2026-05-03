const Joi = require('joi');

class ClientRequestDto {
  constructor(data) {
    this.accountNumber = data.accountNumber;
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
    this.idDocumentType = data.idDocumentType;
    this.idDocumentNumber = data.idDocumentNumber;
    this.idDocumentImages = data.idDocumentImages;
    this.preferredContactMethod = data.preferredContactMethod;
    this.notes = data.notes;
  }

  // Joi validation schema for creating clients
  static createSchema = Joi.object({
    accountNumber: Joi.string().max(64).allow(null, '')
      .messages({
        'string.max': 'Account number cannot exceed 64 characters'
      }),

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

    gender: Joi.string().valid('male', 'female', 'other').required()
      .messages({
        'string.empty': 'Gender is required',
        'any.only': 'Gender must be male, female, or other',
        'any.required': 'Gender is required'
      }),

    occupation: Joi.string().trim().min(1).max(128).required()
      .messages({
        'string.empty': 'Occupation is required',
        'string.max': 'Occupation cannot exceed 128 characters',
        'any.required': 'Occupation is required'
      }),

    employer: Joi.string().max(128).allow(null, '')
      .messages({
        'string.max': 'Employer cannot exceed 128 characters'
      }),

    monthlyIncome: Joi.number().min(0).required()
      .messages({
        'number.base': 'Monthly income must be a number',
        'number.min': 'Monthly income cannot be negative',
        'any.required': 'Monthly income is required'
      }),

    address: Joi.object({
      street: Joi.string().trim().min(1).required().messages({ 'any.required': 'Street is required', 'string.empty': 'Street is required' }),
      city: Joi.string().trim().min(1).required().messages({ 'any.required': 'City is required', 'string.empty': 'City is required' }),
      state: Joi.string().allow('', null),
      postalCode: Joi.string().allow('', null),
      country: Joi.string().trim().min(1).required().messages({ 'any.required': 'Country is required', 'string.empty': 'Country is required' })
    }).required()
      .messages({
        'object.base': 'Address must be an object',
        'any.required': 'Address is required'
      }),

    idDocumentType: Joi.string().trim().min(1).max(32).required()
      .messages({
        'string.empty': 'ID document type is required',
        'string.max': 'ID document type cannot exceed 32 characters',
        'any.required': 'ID document type is required'
      }),

    idDocumentNumber: Joi.string().trim().min(1).max(255).required()
      .messages({
        'string.empty': 'ID document number is required',
        'string.max': 'ID document number cannot exceed 255 characters',
        'any.required': 'ID document number is required'
      }),

    idDocumentImages: Joi.object({
      front: Joi.string().uri().allow(null, ''),
      back: Joi.string().uri().allow(null, ''),
      selfie: Joi.string().uri().allow(null, '')
    }).allow(null)
      .messages({
        'object.base': 'ID document images must be an object'
      }),

    preferredContactMethod: Joi.string().valid('email', 'phone', 'sms').allow(null, '')
      .messages({
        'any.only': 'Preferred contact method must be email, phone, or sms'
      }),

    notes: Joi.string().allow(null, '')
      .messages({
        'string.base': 'Notes must be a string'
      }),

  });

  // Joi validation schema for updating clients
  static updateSchema = ClientRequestDto.createSchema.fork(
    [
      'accountNumber',
      'firstName',
      'lastName',
      'email',
      'phone',
      'gender',
      'occupation',
      'monthlyIncome',
      'address',
      'idDocumentType',
      'idDocumentNumber'
    ],
    (schema) => schema.optional()
  );
}

module.exports = ClientRequestDto;
