const Joi = require('joi');

class LoanProductRequestDto {
  constructor(data) {
    this.name = data.name;
    this.description = data.description;
    this.interestRate = data.interestRate;
    this.interestType = data.interestType || 'reducing';
    this.penaltyRate = data.penaltyRate || 0;
    this.minimumDownPayment = data.minimumDownPayment || 0;
    this.repaymentPeriodMonths = data.repaymentPeriodMonths;
    this.maxLoanAmount = data.maxLoanAmount;
    this.minLoanAmount = data.minLoanAmount;
    this.fees = data.fees || 0;
    this.currency = data.currency || 'KES';
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.createdBy = data.createdBy;
  }

  // Joi schema for creating a loan product
  static createSchema = Joi.object({
    name: Joi.string().trim().min(3).max(100).required()
      .messages({
        'string.empty': 'Loan product name is required',
        'string.min': 'Loan product name must be at least 3 characters',
        'string.max': 'Loan product name cannot exceed 100 characters',
        'any.required': 'Loan product name is required'
      }),

    description: Joi.string().allow(null, '')
      .messages({
        'string.base': 'Description must be a string'
      }),

    interestRate: Joi.number().min(0).required()
      .messages({
        'number.base': 'Interest rate must be a number',
        'any.required': 'Interest rate is required'
      }),

    interestType: Joi.string().valid('flat', 'reducing').default('reducing')
      .messages({
        'any.only': 'Interest type must be flat or reducing'
      }),

    penaltyRate: Joi.number().min(0).default(0)
      .messages({
        'number.min': 'Penalty rate cannot be negative'
      }),

    minimumDownPayment: Joi.number().min(0).default(0)
      .messages({
        'number.min': 'Minimum down payment cannot be negative'
      }),

    repaymentPeriodMonths: Joi.number().integer().positive().required()
      .messages({
        'number.base': 'Repayment period must be a number',
        'number.positive': 'Repayment period must be greater than zero',
        'any.required': 'Repayment period is required'
      }),

    maxLoanAmount: Joi.number().positive().allow(null)
      .messages({
        'number.base': 'Max loan amount must be a number'
      }),

    minLoanAmount: Joi.number().positive().allow(null)
      .messages({
        'number.base': 'Min loan amount must be a number'
      }),

    fees: Joi.number().min(0).default(0)
      .messages({
        'number.min': 'Fees cannot be negative'
      }),

    currency: Joi.string().length(3).default('KES')
      .messages({
        'string.length': 'Currency must be a 3-letter code'
      }),

    isActive: Joi.boolean().default(true),

    createdBy: Joi.number().integer().required()
      .messages({
        'number.base': 'Created by must be a number',
        'any.required': 'Created by is required'
      })
  }).custom((value, helpers) => {
    if (
      value.maxLoanAmount !== null &&
      value.minLoanAmount !== null &&
      value.minLoanAmount > value.maxLoanAmount
    ) {
      return helpers.error('any.invalid', {
        message: 'Minimum loan amount cannot exceed maximum loan amount'
      });
    }
    return value;
  });

  // Joi schema for updating a loan product
  static updateSchema = LoanProductRequestDto.createSchema.fork(
    ['name', 'interestRate', 'repaymentPeriodMonths', 'createdBy'],
    (schema) => schema.optional()
  );
}

module.exports = LoanProductRequestDto;
