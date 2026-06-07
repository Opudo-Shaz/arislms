const logger = require('../config/logger');
const { getUserId, isAdmin } = require('../utils/helpers');
const collateralService = require('../services/collateralService');

function parseStatus(value) {
  return value ? String(value).trim().toLowerCase() : null;
}

module.exports = {
  async getByLoan(req, res) {
    try {
      const loanId = req.params.loanId;
      const collaterals = await collateralService.getLoanCollaterals(loanId);

      return res.status(200).json({
        success: true,
        data: collaterals
      });
    } catch (error) {
      logger.error(`CollateralController.getByLoan Error: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch collaterals'
      });
    }
  },

  async updateStatus(req, res) {
    try {
      const userId = getUserId(req);
      const status = parseStatus(req.body.status);

      if (!isAdmin(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'User not authorized to manage collateral'
        });
      }

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'status is required'
        });
      }

      const collateral = await collateralService.updateCollateralStatus(req.params.id, status, userId, {
        notes: req.body.notes
      });

      if (!collateral) {
        return res.status(404).json({
          success: false,
          message: 'Collateral not found'
        });
      }

      return res.status(200).json({
        success: true,
        data: collateral
      });
    } catch (error) {
      logger.error(`CollateralController.updateStatus Error: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
};