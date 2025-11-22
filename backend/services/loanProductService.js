const LoanProduct = require('../models/loanProductModel');

const { formatDateWithOffset } = require('../utils/helpers');

module.exports = {
  
  async createProduct(data, user) {
    data.createdBy = user.id;
    return await LoanProduct.create(data);
  },

  async getProducts() {
    return await LoanProduct.findAll();
  },

  async getProduct(id) {
    return await LoanProduct.findByPk(id);
  },

  async updateProduct(id, data) {
    const product = await LoanProduct.findByPk(id);
    if (!product) return null;

  // set updatedAt to formatted string like `2025-11-21 11:52:55.984 +0300`
  product.updated_at = formatDateWithOffset(new Date());
  await product.update(data);
    return product;
  },

  async deleteProduct(id) {
    const product = await LoanProduct.findByPk(id);
    if (!product) return null;

    await product.destroy();
    return true;
  }

};
