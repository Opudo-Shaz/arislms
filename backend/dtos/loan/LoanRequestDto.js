// dtos/loan/LoanRequestDTO.js
const Joi = require('joi');

class LoanRequestDto {
  constructor(data) {
    this.clientId = data.clientId;
    this.loanProductId = data.loanProductId;
    this.principalAmount = data.principalAmount;
    this.currency = data.currency;
    this.interestRate = data.interestRate;
    this.interestType = data.interestType;
    this.termMonths = data.termMonths;
    this.startDate = data.startDate;
    this.endDate = data.endDate;
    this.collateral = data.collateral;
    this.notes = data.notes;
  }

  // Joi validation schema for creating loans
  static createSchema = Joi.object({
    clientId: Joi.number().integer().required()
      .messages({
        'number.base': 'Client ID must be a number',
        'any.required': 'Client ID is required'
      }),
    loanProductId: Joi.number().integer().required()
      .messages({
        'number.base': 'Loan Product ID must be a number',
        'any.required': 'Loan Product ID is required'
      }),
    principalAmount: Joi.number().min(0).required()
      .messages({
        'number.base': 'Principal amount must be a number',
        'number.min': 'Principal amount cannot be negative',
        'any.required': 'Principal amount is required'
      }),
    currency: Joi.string().length(3).required()
      .messages({
        'string.length': 'Currency code must be 3 characters (e.g., USD, KES)',
        'any.required': 'Currency is required'
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
    startDate: Joi.date().iso().required()
      .messages({
        'date.base': 'Start date must be a valid date',
        'any.required': 'Start date is required'
      }),
    endDate: Joi.date().iso().required()
      .messages({
        'date.base': 'End date must be a valid date',
        'any.required': 'End date is required'
      }),
    collateral: Joi.object().allow(null, '')
      .messages({
        'object.base': 'Collateral must be an object'
      }),
    notes: Joi.string().max(500).allow(null, '')
      .messages({
        'string.max': 'Notes cannot exceed 500 characters'
      })
  });

  // Joi validation schema for updating loans
  static updateSchema = Joi.object({
    principalAmount: Joi.number().min(0),
    currency: Joi.string().length(3),
    interestRate: Joi.number().min(0).max(100),
    interestType: Joi.string().valid('fixed', 'variable', 'compound'),
    termMonths: Joi.number().integer().min(1),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso(),
    collateral: Joi.object().allow(null, ''),
    status: Joi.string().valid('pending', 'active', 'completed', 'defaulted', 'cancelled'),
    notes: Joi.string().max(500).allow(null, '')
  });
}

module.exports = LoanRequestDto;
