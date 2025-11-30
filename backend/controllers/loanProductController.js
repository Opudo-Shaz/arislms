const loanProductService = require('../services/loanProductService');
const logger = require('../config/logger');
const { getUserId } = require('../utils/helpers');

module.exports = {
  async create(req, res) {
    try {
      const userId = getUserId(req);
      const payload = { ...req.body, createdBy: userId };

      const product = await loanProductService.createProduct(payload, req.user);

      logger.info(`Loan product created by user ${userId}`);
      res.status(201).json({ success: true, data: product });
    } catch (err) {
      logger.error(`LoanProductController.create Error: ${err.message}`);
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async getAll(req, res) {
    try {
      const products = await loanProductService.getProducts();
      res.json({ success: true, data: products });
    } catch (err) {
      logger.error(`LoanProductController.getAll Error: ${err.message}`);
      res.status(500).json({ success: false, message: 'Failed to fetch loan products' });
    }
  },

  async getOne(req, res) {
    try {
      const product = await loanProductService.getProduct(req.params.id);

      if (!product) {
        logger.warn(`Loan product not found: ${req.params.id}`);
        return res.status(404).json({ success: false, message: 'Not found' });
      }

      res.json({ success: true, data: product });
    } catch (err) {
      logger.error(`LoanProductController.getOne Error: ${err.message}`);
      res.status(500).json({ success: false, message: 'Error fetching product' });
    }
  },

  async update(req, res) {
    try {
      const product = await loanProductService.updateProduct(req.params.id, req.body);

      if (!product) {
        logger.warn(`Loan product update failed. Not found: ${req.params.id}`);
        return res.status(404).json({ success: false, message: 'Not found' });
      }

      res.json({ success: true, data: product });
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
