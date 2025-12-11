// dtos/loanProduct/LoanProductRequestDTO.js
const Joi = require('joi');

class LoanProductRequestDto {
  constructor(data) {
    this.name = data.name;
    this.description = data.description;
    this.currency = data.currency;
    this.minAmount = data.minAmount;
    this.maxAmount = data.maxAmount;
    this.interestRate = data.interestRate;
    this.interestType = data.interestType;
    this.termMonths = data.termMonths;
    this.repaymentFrequency = data.repaymentFrequency;
    this.fees = data.fees;
    this.status = data.status || 'active';
  }

  // Joi validation schema for creating loan products
  static createSchema = Joi.object({
    name: Joi.string().trim().min(2).max(128).required()
      .messages({
        'string.empty': 'Product name is required',
        'string.min': 'Product name must be at least 2 characters',
        'string.max': 'Product name cannot exceed 128 characters',
        'any.required': 'Product name is required'
      }),
    description: Joi.string().max(500).allow(null, '')
      .messages({
        'string.max': 'Description cannot exceed 500 characters'
      }),
    currency: Joi.string().length(3).required()
      .messages({
        'string.length': 'Currency code must be 3 characters (e.g., USD, KES)',
        'any.required': 'Currency is required'
      }),
    minAmount: Joi.number().min(0).required()
      .messages({
        'number.base': 'Minimum amount must be a number',
        'number.min': 'Minimum amount cannot be negative',
        'any.required': 'Minimum amount is required'
      }),
    maxAmount: Joi.number().min(Joi.ref('minAmount')).required()
      .messages({
        'number.base': 'Maximum amount must be a number',
        'number.min': 'Maximum amount must be greater than or equal to minimum amount',
        'any.required': 'Maximum amount is required'
      }),
    interestRate: Joi.number().min(0).max(100).required()
      .messages({
        'number.base': 'Interest rate must be a number',
        'number.min': 'Interest rate cannot be negative',
        'number.max': 'Interest rate cannot exceed 100',
        'any.required': 'Interest rate is required'
      }),
    interestType: Joi.string().valid('fixed', 'variable', 'compound').required()
      .messages({
        'any.only': 'Interest type must be fixed, variable, or compound',
        'any.required': 'Interest type is required'
      }),
    termMonths: Joi.number().integer().min(1).required()
      .messages({
        'number.base': 'Term must be a number',
        'number.min': 'Term must be at least 1 month',
        'any.required': 'Term (months) is required'
      }),
    repaymentFrequency: Joi.string().valid('monthly', 'quarterly', 'semi-annual', 'annual').required()
      .messages({
        'any.only': 'Repayment frequency must be monthly, quarterly, semi-annual, or annual',
        'any.required': 'Repayment frequency is required'
      }),
    fees: Joi.object().allow(null, '')
      .messages({
        'object.base': 'Fees must be an object'
      }),
    status: Joi.string().valid('active', 'inactive').default('active')
      .messages({
        'any.only': 'Status must be active or inactive'
      })
  });

  // Joi validation schema for updating loan products
  static updateSchema = Joi.object({
    name: Joi.string().trim().min(2).max(128),
    description: Joi.string().max(500).allow(null, ''),
    currency: Joi.string().length(3),
    minAmount: Joi.number().min(0),
    maxAmount: Joi.number().min(Joi.ref('minAmount')),
    interestRate: Joi.number().min(0).max(100),
    interestType: Joi.string().valid('fixed', 'variable', 'compound'),
    termMonths: Joi.number().integer().min(1),
    repaymentFrequency: Joi.string().valid('monthly', 'quarterly', 'semi-annual', 'annual'),
    fees: Joi.object().allow(null, ''),
    status: Joi.string().valid('active', 'inactive')
  });
}

module.exports = LoanProductRequestDto;
