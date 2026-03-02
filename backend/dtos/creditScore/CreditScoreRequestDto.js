const Joi = require('joi');

class CreditScoreRequestDto {
  constructor(data) {
    this.clientId = data.clientId;
    this.loanId = data.loanId;
    this.riskScore = data.riskScore;
    this.riskGrade = data.riskGrade;
    this.riskDti = data.riskDti;
    this.scoringBreakdown = data.scoringBreakdown;
    this.scoringModelVersion = data.scoringModelVersion;
    this.evaluatedBy = data.evaluatedBy;
    this.notes = data.notes;
  }

  // Joi schema for creating a credit score
  static createSchema = Joi.object({
    clientId: Joi.number().integer().allow(null)
      .messages({
        'number.base': 'Client ID must be a number'
      }),

    loanId: Joi.number().integer().allow(null)
      .messages({
        'number.base': 'Loan ID must be a number'
      }).external(async (value, helpers) => {
        // At least one of clientId or loanId must be provided
        if (!helpers.state.ancestors[0].clientId && !value) {
          throw new Error('Either clientId or loanId (or both) must be provided');
        }
      }),

    riskScore: Joi.number().integer().min(0).max(100).allow(null)
      .messages({
        'number.base': 'Risk score must be a number',
        'number.min': 'Risk score cannot be less than 0',
        'number.max': 'Risk score cannot exceed 100'
      }),

    riskGrade: Joi.string().valid('A', 'B', 'C', 'D', 'E', 'F').allow(null, '')
      .messages({
        'any.only': 'Risk grade must be one of: A, B, C, D, E, F'
      }),

    riskDti: Joi.number().min(0).allow(null)
      .messages({
        'number.base': 'Risk DTI must be a number',
        'number.min': 'Risk DTI cannot be negative'
      }),

    scoringBreakdown: Joi.object().allow(null)
      .messages({
        'object.base': 'Scoring breakdown must be an object'
      }),

    scoringModelVersion: Joi.string().max(50).allow(null, '')
      .messages({
        'string.max': 'Scoring model version cannot exceed 50 characters'
      }),

    evaluatedBy: Joi.number().integer().allow(null)
      .messages({
        'number.base': 'Evaluated by must be a number'
      }),

    notes: Joi.string().allow(null, '')
      .messages({
        'string.base': 'Notes must be a string'
      })
  });

  // Joi schema for updating a credit score
  static updateSchema = CreditScoreRequestDto.createSchema.fork(
    ['clientId', 'loanId'],
    (schema) => schema.optional()
  );
}

module.exports = CreditScoreRequestDto;
