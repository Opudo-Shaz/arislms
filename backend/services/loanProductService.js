const LoanProduct = require('../models/loanProductModel');
const logger = require('../config/logger');
const { formatDateWithOffset } = require('../utils/helpers');
const AuditLogger = require('../utils/auditLogger');
// const { formatDateWithOffset, getUserId } = require('../utils/helpers');

module.exports = {
  async createProduct(data, creatorId = null, userAgent = 'unknown') {
    try {
      data.createdBy = creatorId;
      const newProduct = await LoanProduct.create(data);

      // Validate the created product before logging
      if (!newProduct || !newProduct.id) {
        logger.error('Loan product creation returned invalid result', { newProduct });
        throw new Error('Loan product creation failed: invalid product object returned');
      }

      // Log to audit table after successful creation
      await AuditLogger.log({
        entityType: 'LOAN_PRODUCT',
        entityId: newProduct.id,
        action: 'CREATE',
        data,
        actorId: creatorId || 'system',
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      logger.info(`Loan product created: id=${newProduct.id} name=${newProduct.name} by user ${creatorId}`);
      return newProduct;
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

  async updateProduct(id, data, updatorId = null, userAgent = 'unknown') {
    try {
      const product = await LoanProduct.findByPk(id);
      if (!product) return null;

      product.updated_at = formatDateWithOffset(new Date());
      await product.update(data);

      // Log to audit table after successful update
      await AuditLogger.log({
        entityType: 'LOAN_PRODUCT',
        entityId: id,
        action: 'UPDATE',
        data: { changes: data },
        actorId: updatorId || 'system',
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      logger.info(`Loan product updated: id=${id} by user ${updatorId}`);
      return product;
    } catch (error) {
      logger.error(`LoanProductService.updateProduct Error: ${error.message}`);
      throw error;
    }
  },

  async deleteProduct(id, deletorId = null, userAgent = 'unknown') {
    try {
      const product = await LoanProduct.findByPk(id);
      if (!product) return null;

      const deletedData = product.toJSON();
      await product.destroy();

      // Log to audit table after successful deletion
      await AuditLogger.log({
        entityType: 'LOAN_PRODUCT',
        entityId: id,
        action: 'DELETE',
        data: deletedData,
        actorId: deletorId || 'system',
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      logger.warn(`Loan product deleted: id=${id} by user ${deletorId}`);
      return true;
    } catch (error) {
      logger.error(`LoanProductService.deleteProduct Error: ${error.message}`);
      throw error;
    }
  }
};
