const Joi = require('joi');

class LoanRequestDto {
  constructor(data) {
    this.clientId = data.clientId;
    this.loanProductId = data.loanProductId;
    this.principalAmount = data.principalAmount;
    this.termMonths = data.termMonths;
    this.startDate = data.startDate;
    this.fees = data.fees || 0;
    this.penalties = data.penalties || 0;
    this.collateral = data.collateral;
    this.coSignerId = data.coSignerId;
    this.coSignerIdNumber = data.coSignerIdNumber;
    this.notes = data.notes;
  }

  // Joi schema for creating a loan
  static createSchema = Joi.object({
    clientId: Joi.number().integer().required()
      .messages({
        'number.base': 'Client ID must be a number',
        'any.required': 'Client ID is required'
      }),

    loanProductId: Joi.number().integer().required()
      .messages({
        'number.base': 'Loan product ID must be a number',
        'any.required': 'Loan product ID is required'
      }),

    principalAmount: Joi.number().positive().required()
      .messages({
        'number.base': 'Principal amount must be a number',
        'number.positive': 'Principal amount must be greater than zero',
        'any.required': 'Principal amount is required'
      }),
    startDate: Joi.date().iso().required()
      .messages({
        'date.base': 'Start date must be a valid date',
        'any.required': 'Start date is required'
      }),
    collateral: Joi.alternatives().try(
      Joi.object({
        type: Joi.string().trim().required()
          .messages({
            'string.base': 'Collateral type must be a string',
            'any.required': 'Collateral type is required'
          }),
        details: Joi.string().trim().required()
          .messages({
            'string.base': 'Collateral details must be a string',
            'any.required': 'Collateral details are required'
          }),
        referenceNumber: Joi.string().trim().allow(null, ''),
        registrationNumber: Joi.string().trim().allow(null, ''),
        estimatedValue: Joi.number().positive().required()
          .messages({
            'number.base': 'Collateral estimated value must be a number',
            'number.positive': 'Collateral estimated value must be greater than zero',
            'any.required': 'Collateral estimated value is required'
          }),
        notes: Joi.string().allow(null, '')
      }),
      Joi.array().items(
        Joi.object({
          type: Joi.string().trim().required(),
          details: Joi.string().trim().required(),
          referenceNumber: Joi.string().trim().allow(null, ''),
          registrationNumber: Joi.string().trim().allow(null, ''),
          estimatedValue: Joi.number().positive().required()
            .messages({
              'number.base': 'Collateral estimated value must be a number',
              'number.positive': 'Collateral estimated value must be greater than zero',
              'any.required': 'Collateral estimated value is required'
            }),
          notes: Joi.string().allow(null, '')
        })
      ),
      Joi.valid(null)
    ).messages({
      'alternatives.match': 'Collateral must be an object or an array of collateral items'
    }),

    coSignerId: Joi.number().integer().allow(null)
      .messages({
        'number.base': 'Co-signer ID must be a number'
      }),

    coSignerIdNumber: Joi.string().trim().allow(null, '')
      .messages({
        'string.base': 'Co-signer ID number must be a string'
      }),

    notes: Joi.string().allow(null, '')
      .messages({
        'string.base': 'Notes must be a string'
      })
  });

  // Joi schema for updating a loan
  static updateSchema = LoanRequestDto.createSchema.fork(
    [
      'clientId',
      'loanProductId',
      'principalAmount',
      'startDate'
    ],
    (schema) => schema.optional()
  );
}

module.exports = LoanRequestDto;
