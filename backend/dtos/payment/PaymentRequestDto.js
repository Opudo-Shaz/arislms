// dtos/payment/PaymentRequestDTO.js
const Joi = require('joi');

class PaymentRequestDto {
  constructor(data) {
    this.loanId = data.loanId;
    this.amount = data.amount;
    this.paymentDate = data.paymentDate;
    this.method = data.method;
    this.notes = data.notes;
  }

  // Joi validation schema for creating payments
  static createSchema = Joi.object({
    loanId: Joi.number().integer().required()
      .messages({
        'number.base': 'Loan ID must be a number',
        'any.required': 'Loan ID is required'
      }),
    amount: Joi.number().min(0).required()
      .messages({
        'number.base': 'Amount must be a number',
        'number.min': 'Amount cannot be negative',
        'any.required': 'Amount is required'
      }),
    paymentDate: Joi.date().iso().required()
      .messages({
        'date.base': 'Payment date must be a valid date',
        'any.required': 'Payment date is required'
      }),
    method: Joi.string().valid('cash', 'transfer', 'cheque', 'mobile_money').required()
      .messages({
        'any.only': 'Payment method must be cash, transfer, cheque, or mobile_money',
        'any.required': 'Payment method is required'
      }),
    notes: Joi.string().max(500).allow(null, '')
      .messages({
        'string.max': 'Notes cannot exceed 500 characters'
      })
  });

  // Joi validation schema for updating payments
  static updateSchema = Joi.object({
    amount: Joi.number().min(0),
    paymentDate: Joi.date().iso(),
    method: Joi.string().valid('cash', 'transfer', 'cheque', 'mobile_money'),
    status: Joi.string().valid('pending', 'completed', 'failed', 'cancelled'),
    notes: Joi.string().max(500).allow(null, '')
  });
}

module.exports = PaymentRequestDto;
