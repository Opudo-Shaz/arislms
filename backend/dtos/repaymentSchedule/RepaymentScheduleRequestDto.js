const Joi = require('joi');

class RepaymentScheduleRequestDto {
  constructor(data) {
    this.loanId = data.loanId;
    this.installmentNumber = data.installmentNumber;
    this.dueDate = data.dueDate;
    this.principalAmount = data.principalAmount;
    this.interestAmount = data.interestAmount;
    this.totalAmount = data.totalAmount;
    this.paidAmount = data.paidAmount || 0;
    this.paidDate = data.paidDate;
    this.status = data.status || 'pending';
    this.remainingBalance = data.remainingBalance;
    this.notes = data.notes;
  }

  // Schema for creating a repayment schedule entry
  static createSchema = Joi.object({
    loanId: Joi.number().integer().required()
      .messages({
        'number.base': 'Loan ID must be a number',
        'any.required': 'Loan ID is required'
      }),

    installmentNumber: Joi.number().integer().positive().required()
      .messages({
        'number.base': 'Installment number must be a number',
        'number.positive': 'Installment number must be positive',
        'any.required': 'Installment number is required'
      }),

    dueDate: Joi.date().required()
      .messages({
        'date.base': 'Due date must be a valid date',
        'any.required': 'Due date is required'
      }),

    principalAmount: Joi.number().precision(2).required()
      .messages({
        'number.base': 'Principal amount must be a number',
        'any.required': 'Principal amount is required'
      }),

    interestAmount: Joi.number().precision(2).required()
      .messages({
        'number.base': 'Interest amount must be a number',
        'any.required': 'Interest amount is required'
      }),

    totalAmount: Joi.number().precision(2).required()
      .messages({
        'number.base': 'Total amount must be a number',
        'any.required': 'Total amount is required'
      }),

    paidAmount: Joi.number().precision(2).default(0)
      .messages({
        'number.base': 'Paid amount must be a number'
      }),

    paidDate: Joi.date().allow(null)
      .messages({
        'date.base': 'Paid date must be a valid date'
      }),

    status: Joi.string().valid('pending', 'paid', 'overdue', 'partial').default('pending')
      .messages({
        'string.base': 'Status must be a string',
        'any.only': 'Status must be one of: pending, paid, overdue, partial'
      }),

    remainingBalance: Joi.number().precision(2).required()
      .messages({
        'number.base': 'Remaining balance must be a number',
        'any.required': 'Remaining balance is required'
      }),

    notes: Joi.string().allow(null, '').max(500)
      .messages({
        'string.max': 'Notes cannot exceed 500 characters'
      })
  });

  // Schema for updating a repayment schedule entry (allow partial updates)
  static updateSchema = Joi.object({
    dueDate: Joi.date()
      .messages({
        'date.base': 'Due date must be a valid date'
      }),

    principalAmount: Joi.number().precision(2)
      .messages({
        'number.base': 'Principal amount must be a number'
      }),

    interestAmount: Joi.number().precision(2)
      .messages({
        'number.base': 'Interest amount must be a number'
      }),

    totalAmount: Joi.number().precision(2)
      .messages({
        'number.base': 'Total amount must be a number'
      }),

    paidAmount: Joi.number().precision(2)
      .messages({
        'number.base': 'Paid amount must be a number'
      }),

    paidDate: Joi.date().allow(null)
      .messages({
        'date.base': 'Paid date must be a valid date'
      }),

    status: Joi.string().valid('pending', 'paid', 'overdue', 'partial')
      .messages({
        'string.base': 'Status must be a string',
        'any.only': 'Status must be one of: pending, paid, overdue, partial'
      }),

    remainingBalance: Joi.number().precision(2)
      .messages({
        'number.base': 'Remaining balance must be a number'
      }),

    notes: Joi.string().allow(null, '').max(500)
      .messages({
        'string.max': 'Notes cannot exceed 500 characters'
      })
  }).min(1);

  static validate(data, isUpdate = false) {
    const schema = isUpdate ? this.updateSchema : this.createSchema;
    return schema.validate(data, { abortEarly: false });
  }
}

module.exports = RepaymentScheduleRequestDto;
