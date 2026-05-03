const Joi = require('joi');
const AccountType = require('../../enums/accountType');

class ChartOfAccountRequestDto {
  constructor(data) {
    this.code = data.code;
    this.name = data.name;
    this.type = data.type;
    this.normalBalance = data.normalBalance;
    this.description = data.description;
    this.parentAccountId = data.parentAccountId;
    this.isActive = data.isActive;
  }

  static createSchema = Joi.object({
    code: Joi.string().max(20).required()
      .messages({ 'any.required': 'Account code is required' }),

    name: Joi.string().max(120).required()
      .messages({ 'any.required': 'Account name is required' }),

    type: Joi.string().valid(...Object.values(AccountType)).required()
      .messages({ 'any.only': `Type must be one of: ${Object.values(AccountType).join(', ')}` }),

    normalBalance: Joi.string().valid('DEBIT', 'CREDIT').required()
      .messages({ 'any.only': 'Normal balance must be DEBIT or CREDIT' }),

    description: Joi.string().max(500).allow(null, '').optional(),

    parentAccountId: Joi.number().integer().allow(null).optional(),
  });

  static updateSchema = ChartOfAccountRequestDto.createSchema.fork(
    ['code', 'name', 'type', 'normalBalance'],
    (schema) => schema.optional()
  ).append({
    isActive: Joi.boolean().optional(),
  });
}

module.exports = ChartOfAccountRequestDto;
