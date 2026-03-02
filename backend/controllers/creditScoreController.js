const creditScoreService = require('../services/creditScoreService');
const logger = require('../config/logger');
const { getUserId, isAdmin } = require('../utils/helpers');
const { validateSync } = require('../utils/validationMiddleware');
const CreditScoreResponseDto = require('../dtos/creditScore/CreditScoreResponseDto');
const CreditScoreRequestDto = require('../dtos/creditScore/CreditScoreRequestDto');

const creditScoreController = {
  // ✅ Create credit score
  async createCreditScore(req, res) {
    try {
      const userId = getUserId(req);
      const userAgent = req.headers['user-agent'];
      logger.info(`User ${userId} creating credit score`);

      // Validate request payload with Joi schema
      const validation = validateSync(req.body, CreditScoreRequestDto.createSchema);
      if (!validation.valid) {
        logger.warn(`Credit score creation validation failed: ${JSON.stringify(validation.errors)}`);
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validation.errors
        });
      }

      const creditScore = await creditScoreService.createCreditScore(validation.value, req.user, userAgent);

      return res.status(201).json({
        success: true,
        message: 'Credit score created successfully',
        data: new CreditScoreResponseDto(creditScore)
      });
    } catch (error) {
      logger.error(`Create Credit Score Error: ${error.message}`);

      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },

  // ✅ Get all credit scores
  async getAllCreditScores(req, res) {
    try {
      const userId = getUserId(req);
      logger.info(`User ${userId} fetching all credit scores`);

      const creditScores = await creditScoreService.getAllCreditScores();
      const result = creditScores.map(cs => new CreditScoreResponseDto(cs));

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error(`Get All Credit Scores Error: ${error.message}`);

      return res.status(500).json({
        success: false,
        message: 'Unable to fetch credit scores'
      });
    }
  },

  // ✅ Get single credit score by ID
  async getCreditScore(req, res) {
    try {
      const userId = getUserId(req);
      const id = req.params.id;

      logger.info(`User ${userId} fetching credit score ${id}`);

      const creditScore = await creditScoreService.getCreditScoreById(id);

      return res.status(200).json({
        success: true,
        data: new CreditScoreResponseDto(creditScore)
      });
    } catch (error) {
      logger.error(`Get Credit Score Error: ${error.message}`);

      if (/not found/i.test(error.message)) {
        return res.status(404).json({
          success: false,
          message: 'Credit score not found'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error fetching credit score'
      });
    }
  },

  // ✅ Get credit scores by client ID
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

  // ✅ Get credit score by loan ID
  async getCreditScoreByLoan(req, res) {
    try {
      const userId = getUserId(req);
      const loanId = req.params.loanId;

      logger.info(`User ${userId} fetching credit score for loan ${loanId}`);

      const creditScore = await creditScoreService.getCreditScoreByLoanId(loanId);

      return res.status(200).json({
        success: true,
        data: new CreditScoreResponseDto(creditScore)
      });
    } catch (error) {
      logger.error(`Get Credit Score By Loan Error: ${error.message}`);

      if (/not found/i.test(error.message)) {
        return res.status(404).json({
          success: false,
          message: 'No credit score found for this loan'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error fetching credit score for loan'
      });
    }
  },

  // ✅ Update credit score
  async updateCreditScore(req, res) {
    try {
      const userId = getUserId(req);
      const userAgent = req.headers['user-agent'];
      const id = req.params.id;

      logger.info(`User ${userId} updating credit score ${id}`);

      // Validate request payload with Joi schema
      const validation = validateSync(req.body, CreditScoreRequestDto.updateSchema);
      if (!validation.valid) {
        logger.warn(`Credit score update validation failed: ${JSON.stringify(validation.errors)}`);
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validation.errors
        });
      }

      const creditScore = await creditScoreService.updateCreditScore(id, validation.value, userId, userAgent);

      return res.status(200).json({
        success: true,
        message: 'Credit score updated successfully',
        data: new CreditScoreResponseDto(creditScore)
      });
    } catch (error) {
      logger.error(`Update Credit Score Error: ${error.message}`);

      if (/not found/i.test(error.message)) {
        return res.status(404).json({
          success: false,
          message: 'Credit score not found'
        });
      }

      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },

  // ✅ Delete credit score
  async deleteCreditScore(req, res) {
    try {
      const userId = getUserId(req);
      const userAgent = req.headers['user-agent'];
      const id = req.params.id;

      logger.info(`User ${userId} deleting credit score ${id}`);

      const result = await creditScoreService.deleteCreditScore(id, userId, userAgent);

      return res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      logger.error(`Delete Credit Score Error: ${error.message}`);

      if (/not found/i.test(error.message)) {
        return res.status(404).json({
          success: false,
          message: 'Credit score not found'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error deleting credit score'
      });
    }
  }
};

module.exports = creditScoreController;
