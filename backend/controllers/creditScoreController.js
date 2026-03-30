const creditScoreService = require('../services/creditScoreService');
const logger = require('../config/logger');
const { getUserId, isAdmin } = require('../utils/helpers');
const CreditScoreResponseDto = require('../dtos/creditScore/CreditScoreResponseDto');
const CreditScoreRequestDto = require('../dtos/creditScore/CreditScoreRequestDto');

const creditScoreController = {






  // Get credit scores by client ID
  async getCreditScoresByClient(req, res) {
    try {
      const userId = getUserId(req);
      const clientId = req.params.clientId;

      logger.info(`User ${userId} fetching credit scores for client ${clientId}`);

      const creditScores = await creditScoreService.getCreditScoresByClientId(clientId);

      if (creditScores.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No credit scores found for this client'
        });
      }

      const result = creditScores.map(cs => new CreditScoreResponseDto(cs));

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error(`Get Credit Scores By Client Error: ${error.message}`);

      return res.status(500).json({
        success: false,
        message: 'Error fetching credit scores for client'
      });
    }
  },






};

module.exports = creditScoreController;