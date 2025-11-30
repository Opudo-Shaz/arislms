const paymentService = require('../services/paymentService');
const logger = require('../config/logger');
const { getUserId } = require('../utils/helpers');

const paymentController = {
  async getAll(req, res) {
    try {
      const userId = getUserId(req);

      logger.info(`User ${userId} fetching all payments`);

      const payments = await paymentService.getAllPayments(req.user.role, userId);

      return res.status(200).json({
        success: true,
        data: payments
      });
    } catch (error) {
      logger.error(`GetAllPayments Error: ${error.message}`);

      return res.status(500).json({
        success: false,
        message: 'Error fetching payments'
      });
    }
  },

  async getByLoan(req, res) {
    try {
      const userId = getUserId(req);
      const { loanId } = req.params;

      logger.info(`User ${userId} fetching payments for loan ${loanId}`);

      const payments = await paymentService.getPaymentsByLoan(loanId);

      return res.status(200).json({
        success: true,
        data: payments
      });
    } catch (error) {
      logger.error(`GetPaymentsByLoan Error (Loan ${req.params.loanId}): ${error.message}`);

      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },

  async create(req, res) {
    try {
      const userId = getUserId(req);

      logger.info(`User ${userId} creating a new payment`);

      const payment = await paymentService.createPayment(req.body, req.user);

      return res.status(201).json({
        success: true,
        message: 'Payment created successfully',
        data: payment
      });
    } catch (error) {
      logger.error(`CreatePayment Error: ${error.message}`);

      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },

  async delete(req, res) {
    try {
      const userId = getUserId(req);
      const paymentId = req.params.id;

      logger.warn(`User ${userId} deleting payment ${paymentId}`);

      const result = await paymentService.deletePayment(paymentId);

      return res.status(200).json({
        success: true,
        message: 'Payment deleted successfully',
        data: result
      });
    } catch (error) {
      logger.error(`DeletePayment Error (${req.params.id}): ${error.message}`);

      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }
};

module.exports = paymentController;
