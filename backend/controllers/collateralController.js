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
  },

  async updateParticulars(req, res) {
    try {
      const userId = getUserId(req);

      if (!isAdmin(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'User not authorized to edit collateral'
        });
      }

      const allowed = ['collateralType', 'description', 'referenceNumber', 'registrationNumber', 'estimatedValue', 'notes'];
      const data = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) data[key] = req.body[key];
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ success: false, message: 'No updatable fields provided' });
      }

      const collateral = await collateralService.updateCollateralParticulars(req.params.id, data, userId);
      if (!collateral) {
        return res.status(404).json({ success: false, message: 'Collateral not found' });
      }

      return res.status(200).json({ success: true, data: collateral });
    } catch (error) {
      logger.error(`CollateralController.updateParticulars Error: ${error.message}`);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};