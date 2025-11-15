const paymentService = require('../services/paymentService');
const logger = require('../config/logger');

const paymentController = {
  async getAll(req, res) {
    try {
      const payments = await paymentService.getAllPayments(req.user.role, req.user.id);
      res.status(200).json({ success: true, data: payments });
    } catch (error) {
      logger.error(`Error fetching payments: ${error.message}`);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getByLoan(req, res) {
    try {
      const { loanId } = req.params;
      const payments = await paymentService.getPaymentsByLoan(loanId);
      res.status(200).json({ success: true, data: payments });
    } catch (error) {
      logger.error(`Error fetching payments for loan ${req.params.loanId}: ${error.message}`);
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async create(req, res) {
    try {
      const payment = await paymentService.createPayment(req.body, req.user);
      res.status(201).json({ success: true, data: payment });
    } catch (error) {
      logger.error(`Error creating payment: ${error.message}`);
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async delete(req, res) {
    try {
      const result = await paymentService.deletePayment(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.error(`Error deleting payment: ${error.message}`);
      res.status(404).json({ success: false, message: error.message });
    }
  },
};

module.exports = paymentController;
