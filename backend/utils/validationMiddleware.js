// utils/validationMiddleware.js
const logger = require('../config/logger');

/**
 * Validates request payload against a Joi schema
 * @param {Joi.Schema} schema - The Joi validation schema
 * @returns {Function} Express middleware function
 */
const validateRequest = (schema) => {
  return async (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (error) {
        const messages = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        logger.warn(`Validation error: ${JSON.stringify(messages)}`);
        
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: messages
        });
      }

      // Replace req.body with validated and sanitized data
      req.body = value;
      next();
    } catch (err) {
      logger.error(`Validation middleware error: ${err.message}`);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during validation'
      });
    }
  };
};

/**
 * Validates data synchronously and returns validation result
 * @param {Object} data - Data to validate
 * @param {Joi.Schema} schema - The Joi validation schema
 * @returns {Object} Validation result with { valid: boolean, errors: array, value: object }
 */
const validateSync = (data, schema) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });

  if (error) {
    const messages = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return {
      valid: false,
      errors: messages,
      value: null
    };
  }

  return {
    valid: true,
    errors: [],
    value
  };
};

module.exports = {
  validateRequest,
  validateSync
};
