const LoanProduct = require('../models/loanProductModel');
const logger = require('../config/logger');
const { formatDateWithOffset } = require('../utils/helpers');
const { formatDateWithOffset, getUserId } = require('../utils/helpers');

module.exports = {
  async createProduct(data, user) {
    try {
      data.createdBy = getUserId({ user });
      return await LoanProduct.create(data);
    } catch (error) {
      logger.error(`LoanProductService.createProduct Error: ${error.message}`);
      throw error;
    }
  },

  async getProducts() {
    try {
      return await LoanProduct.findAll();
    } catch (error) {
      logger.error(`LoanProductService.getProducts Error: ${error.message}`);
      throw error;
    }
  },

  async getProduct(id) {
    try {
      const product = await LoanProduct.findByPk(id);
      return product;
    } catch (error) {
      logger.error(`LoanProductService.getProduct Error: ${error.message}`);
      throw error;
    }
  },

  async updateProduct(id, data) {
    try {
      const product = await LoanProduct.findByPk(id);
      if (!product) return null;

      product.updated_at = formatDateWithOffset(new Date());
      await product.update(data);
      return product;
    } catch (error) {
      logger.error(`LoanProductService.updateProduct Error: ${error.message}`);
      throw error;
    }
  },

  async deleteProduct(id) {
    try {
      const product = await LoanProduct.findByPk(id);
      if (!product) return null;

      await product.destroy();
      return true;
    } catch (error) {
      logger.error(`LoanProductService.deleteProduct Error: ${error.message}`);
      throw error;
    }
  }
};
