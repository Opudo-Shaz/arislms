const Joi = require('joi');

const lineSchema = Joi.object({
  accountCode: Joi.string().max(20).required()
    .messages({ 'any.required': 'accountCode is required on each line' }),

  debit: Joi.number().min(0).default(0),
  credit: Joi.number().min(0).default(0),

  description: Joi.string().max(255).allow(null, '').optional(),
  loanId: Joi.number().integer().allow(null).optional(),
  clientId: Joi.number().integer().allow(null).optional(),
}).custom((value, helpers) => {
  const d = value.debit || 0;
  const c = value.credit || 0;
  if (d === 0 && c === 0) {
    return helpers.error('any.invalid');
  }
  if (d > 0 && c > 0) {
    return helpers.error('any.invalid');
  }
  return value;
}, 'debit-or-credit').messages({
  'any.invalid': 'Each line must have either a debit or a credit value, not both and not neither',
});

class JournalEntryRequestDto {
  constructor(data) {
    this.entryDate = data.entryDate;
    this.description = data.description;
    this.sourceType = data.sourceType || 'MANUAL';
    this.lines = data.lines;
  }

  static createSchema = Joi.object({
    entryDate: Joi.string().isoDate().required()
      .messages({ 'any.required': 'entryDate is required (YYYY-MM-DD)' }),

    description: Joi.string().max(500).allow(null, '').optional(),

    sourceType: Joi.string()
      .valid('MANUAL', 'EXPENSE')
      .default('MANUAL'),

    lines: Joi.array().items(lineSchema).min(2).required()
      .messages({
        'array.min': 'At least two lines are required',
        'any.required': 'lines are required',
      }),
  });
}

module.exports = JournalEntryRequestDto;
