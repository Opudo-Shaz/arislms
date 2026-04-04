const Joi = require('joi');

class PaymentRequestDto {
  constructor(data) {
    this.clientId = data.clientId;
    this.loanId = data.loanId;
    this.amount = data.amount;
    this.currency = data.currency || 'KES';
    this.paymentMethod = data.paymentMethod;
    this.externalRef = data.externalRef;
    this.payerName = data.payerName;
    this.payerPhone = data.payerPhone;
    this.transactionDate = data.transactionDate;
    this.paymentDate = data.paymentDate;
    this.notes = data.notes;
  }

  // Joi schema for creating a payment
  static createSchema = Joi.object({
    clientId: Joi.number().integer().required()
      .messages({
        'number.base': 'Client ID must be a number',
        'any.required': 'Client ID is required'
      }),

    loanId: Joi.number().integer().required()
      .messages({
        'number.base': 'Loan ID must be a number',
        'any.required': 'Loan ID is required'
      }),

    amount: Joi.number().positive().required()
      .messages({
        'number.base': 'Amount must be a number',
        'number.positive': 'Amount must be greater than zero',
        'any.required': 'Amount is required'
      }),

    currency: Joi.string().length(3).default('KES')
      .messages({
        'string.length': 'Currency must be a 3-letter code'
      }),

    paymentMethod: Joi.string().max(32).allow(null, '')
      .messages({
        'string.max': 'Payment method cannot exceed 32 characters'
      }),

    externalRef: Joi.string().max(128).allow(null, '')
      .messages({
        'string.max': 'External reference cannot exceed 128 characters'
      }),

    payerName: Joi.string().max(128).allow(null, '')
      .messages({
        'string.max': 'Payer name cannot exceed 128 characters'
      }),

    payerPhone: Joi.string().pattern(/^\+?\d{7,32}$/).allow(null, '')
      .messages({
        'string.pattern.base': 'Payer phone must be a valid phone number'
      }),

    transactionDate: Joi.date().iso().allow(null)
      .messages({
        'date.base': 'Transaction date must be a valid date'
      }),

    paymentDate: Joi.date().iso().default(() => new Date())
      .messages({
        'date.base': 'Payment date must be a valid date'
      }),

    notes: Joi.string().allow(null, '')
      .messages({
        'string.base': 'Notes must be a string'
      }),
  });

  // Joi schema for updating a payment
  static updateSchema = PaymentRequestDto.createSchema.fork(
    ['clientId', 'loanId', 'amount'],
    (schema) => schema.optional()
  );
}

module.exports = PaymentRequestDto;
