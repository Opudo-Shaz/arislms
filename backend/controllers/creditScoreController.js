const creditScoreService = require('../services/creditScoreService');
const logger = require('../config/logger');
const { getUserId, isAdmin } = require('../utils/helpers');
const CreditScoreResponseDto = require('../dtos/creditScore/CreditScoreResponseDto');
const CreditScoreRequestDto = require('../dtos/creditScore/CreditScoreRequestDto');

const creditScoreController = {






  // Get credit scores by client ID
  async getCreditScoreByClientId(req, res) {
    try {
      const userId = getUserId(req);
      const clientId = req.params.clientId;

      logger.info(`User ${userId} fetching credit scores for client ${clientId}`);

      const creditScore = await creditScoreService.getCreditScoreByClientId(clientId);

      if (!creditScore) {
        return res.status(404).json({
          success: false,
          message: 'No credit score found for this client'
        });
      }

      return res.status(200).json({
        success: true,
        data: new CreditScoreResponseDto(creditScore)
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