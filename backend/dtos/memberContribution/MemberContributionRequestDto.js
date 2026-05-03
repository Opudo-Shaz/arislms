const Joi = require('joi');
const ContributionType = require('../../enums/contributionType');

class MemberContributionRequestDto {
  constructor(data) {
    this.clientId = data.clientId;
    this.amount = data.amount;
    this.contributionDate = data.contributionDate;
    this.type = data.type || ContributionType.CONTRIBUTION;
    this.notes = data.notes;
  }

  static createSchema = Joi.object({
    clientId: Joi.number().integer().required()
      .messages({ 'any.required': 'clientId is required' }),

    amount: Joi.number().positive().required()
      .messages({
        'number.positive': 'Amount must be greater than zero',
        'any.required': 'amount is required',
      }),

    contributionDate: Joi.string().isoDate().optional()
      .messages({ 'string.isoDate': 'contributionDate must be a valid date (YYYY-MM-DD)' }),

    type: Joi.string()
      .valid(...Object.values(ContributionType))
      .default(ContributionType.CONTRIBUTION),

    notes: Joi.string().max(500).allow(null, '').optional(),
  });
}

module.exports = MemberContributionRequestDto;
