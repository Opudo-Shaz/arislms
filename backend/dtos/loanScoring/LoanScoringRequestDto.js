// dtos/loanScoring/LoanScoringRequestDto.js
const Joi = require('joi');

class LoanScoringRequestDto {
  static createSchema = Joi.object({
    clientId: Joi.number().integer().required(),
    loanProductId: Joi.number().integer().required(),
    principalAmount: Joi.number().positive().required(),
    startDate: Joi.date().required(),
    termMonths: Joi.number().integer().positive().optional(),
    collateral: Joi.object().optional(),
    coSignerId: Joi.number().integer().optional(),
    notes: Joi.string().optional()
  }).unknown(true);

  static validateSchema = Joi.object({
    clientId: Joi.number().integer().required(),
    loanProductId: Joi.number().integer().required(),
    principalAmount: Joi.number().positive().required(),
    startDate: Joi.date().required(),
    termMonths: Joi.number().integer().positive().optional()
  }).unknown(true);
}

module.exports = LoanScoringRequestDto;
