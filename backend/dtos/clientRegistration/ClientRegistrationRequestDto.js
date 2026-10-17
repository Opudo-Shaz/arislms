const Joi = require('joi');
const { phoneSchema } = require('../../utils/phone');

const ID_DOCUMENT_TYPES = ['national_id', 'passport', 'driving_license', 'alien_id'];
const MIN_AGE_YEARS = 18;

const adult = (value, helpers) => {
  const dob = new Date(value);
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - MIN_AGE_YEARS);
  if (dob > cutoff) return helpers.error('date.adult');
  if (dob.getFullYear() < 1900) return helpers.error('date.base');
  return value;
};

class ClientRegistrationRequestDto {
  static createLinkSchema = Joi.object({
    label: Joi.string().trim().max(150).allow('', null),
    recipients: Joi.array().items(Joi.string().trim().max(255)).max(200).default([]),
  });

  static submitSchema = Joi.object({
    firstName: Joi.string().trim().min(2).max(100).required(),
    lastName: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().trim().lowercase().email().max(255).allow('', null)
      .messages({ 'string.email': 'Email must be a valid email address' }),
    phone: phoneSchema({ required: true, label: 'Phone' }),
    secondaryPhone: phoneSchema({ label: 'Secondary phone', distinctFrom: 'phone' }).allow('', null),
    dateOfBirth: Joi.date().iso().custom(adult).required()
      .messages({
        'date.base': 'Date of birth must be a valid date',
        'date.adult': `You must be at least ${MIN_AGE_YEARS} years old to register`,
        'any.required': 'Date of birth is required',
      }),
    gender: Joi.string().valid('male', 'female', 'other').required(),
    occupation: Joi.string().trim().min(1).max(128).required(),
    employer: Joi.string().trim().max(128).allow('', null),
    monthlyIncome: Joi.number().min(0).max(1e10).required(),
    address: Joi.object({
      street: Joi.string().trim().min(1).max(255).required(),
      city: Joi.string().trim().min(1).max(100).required(),
      state: Joi.string().trim().max(100).allow('', null),
      postalCode: Joi.string().trim().max(20).allow('', null),
      country: Joi.string().trim().min(1).max(100).required(),
    }).required(),
    idDocumentType: Joi.string().valid(...ID_DOCUMENT_TYPES).required(),
    idDocumentNumber: Joi.string().trim().min(1).max(255).required(),
    preferredContactMethod: Joi.string().valid('email', 'phone', 'sms').allow('', null),
    phoneVerificationToken: Joi.string().max(2000).allow('', null),
  });

  static otpRequestSchema = Joi.object({
    phone: phoneSchema({ required: true, label: 'Phone' }),
    name: Joi.string().trim().max(200).allow('', null),
  });

  static otpVerifySchema = Joi.object({
    phone: phoneSchema({ required: true, label: 'Phone' }),
    code: Joi.string().pattern(/^\d{4,10}$/).required()
      .messages({ 'string.pattern.base': 'Enter the numeric verification code' }),
  });
}

module.exports = ClientRegistrationRequestDto;
