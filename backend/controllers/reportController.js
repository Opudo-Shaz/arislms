const reportService = require('../services/reportService');
const logger = require('../config/logger');

const reportController = {
  /**
   * GET /api/reports/portfolio-aging?asOf=YYYY-MM-DD
   * Returns outstanding principal bucketed by days overdue.
   */
  async getPortfolioAging(req, res) {
    try {
      const { asOf } = req.query;
      const result = await reportService.getPortfolioAging(asOf);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      logger.error(`GetPortfolioAging Error: ${err.message}`);
      return res.status(500).json({ success: false, message: 'Error generating portfolio aging report' });
    }
  },
};

module.exports = reportController;
