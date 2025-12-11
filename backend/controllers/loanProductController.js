const loanProductService = require('../services/loanProductService');
const logger = require('../config/logger');
const { getUserId } = require('../utils/helpers');
const { validateSync } = require('../utils/validationMiddleware');
const LoanProductResponseDto = require('../dtos/loanProduct/LoanProductResponseDto');
const LoanProductRequestDto = require('../dtos/loanProduct/LoanProductRequestDto');

module.exports = {
  async create(req, res) {
    try {
      const userId = getUserId(req);
      
      // Validate request payload with Joi schema
      const validation = validateSync(req.body, LoanProductRequestDto.createSchema);
      if (!validation.valid) {
        logger.warn(`Loan product creation validation failed: ${JSON.stringify(validation.errors)}`);
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validation.errors
        });
      }

      const payload = { ...validation.value, createdBy: userId };
      const product = await loanProductService.createProduct(payload, req.user);

      logger.info(`Loan product created by user ${userId}`);
      res.status(201).json({
        success: true,
        data: new LoanProductResponseDto(product)
      });
    } catch (err) {
      logger.error(`LoanProductController.create Error: ${err.message}`);
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async getAll(req, res) {
    try {
      const products = await loanProductService.getProducts();
      const result = products.map(p => new LoanProductResponseDto(p));

      res.json({
        success: true,
        data: result
      });
    } catch (err) {
      logger.error(`LoanProductController.getAll Error: ${err.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch loan products'
      });
    }
  },

  async getOne(req, res) {
    try {
      const product = await loanProductService.getProduct(req.params.id);

      if (!product) {
        logger.warn(`Loan product not found: ${req.params.id}`);
        return res.status(404).json({ success: false, message: 'Not found' });
      }

      res.json({
        success: true,
        data: new LoanProductResponseDto(product)
      });
    } catch (err) {
      logger.error(`LoanProductController.getOne Error: ${err.message}`);
      res.status(500).json({
        success: false,
        message: 'Error fetching product'
      });
    }
  },

  async update(req, res) {
    try {
      // Validate request payload with Joi schema
      const validation = validateSync(req.body, LoanProductRequestDto.updateSchema);
      if (!validation.valid) {
        logger.warn(`Loan product update validation failed: ${JSON.stringify(validation.errors)}`);
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validation.errors
        });
      }

      const product = await loanProductService.updateProduct(req.params.id, validation.value);

      if (!product) {
        logger.warn(`Loan product update failed. Not found: ${req.params.id}`);
        return res.status(404).json({ success: false, message: 'Not found' });
      }

      res.json({
        success: true,
        data: new LoanProductResponseDto(product)
      });
    } catch (err) {
      logger.error(`LoanProductController.update Error: ${err.message}`);
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async delete(req, res) {
    try {
      const deleted = await loanProductService.deleteProduct(req.params.id);

      if (!deleted) {
        logger.warn(`Loan product delete failed. Not found: ${req.params.id}`);
        return res.status(404).json({ success: false, message: 'Not found' });
      }

      res.json({ success: true, message: 'Deleted' });
    } catch (err) {
      logger.error(`LoanProductController.delete Error: ${err.message}`);
      res.status(500).json({ success: false, message: 'Error deleting product' });
    }
  }
};
