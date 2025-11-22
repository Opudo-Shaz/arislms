const loanProductService = require('../services/loanProductService');

module.exports = {

  async create(req, res) {
    try {
      const user = req.user;
      const product = await loanProductService.createProduct(req.body,user);
      res.status(201).json({ success: true, data: product });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async getAll(req, res) {
    const products = await loanProductService.getProducts();
    res.json({ success: true, data: products });
  },

  async getOne(req, res) {
    const product = await loanProductService.getProduct(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Not found" });

    res.json({ success: true, data: product });
  },

  async update(req, res) {
    const product = await loanProductService.updateProduct(req.params.id, req.body);
    if (!product) return res.status(404).json({ success: false, message: "Not found" });

    res.json({ success: true, data: product });
  },

  async delete(req, res) {
    const deleted = await loanProductService.deleteProduct(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Not found" });

    res.json({ success: true, message: "Deleted" });
  }

};
