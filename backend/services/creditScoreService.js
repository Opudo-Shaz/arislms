const CreditScore = require('../models/creditScoreModel');
const Client = require('../models/clientModel');
const Loan = require('../models/loanModel');
const logger = require('../config/logger');
const AuditLogger = require('../utils/auditLogger');

const creditScoreService = {
  // ✅ Create credit score
  async createCreditScore(data, user, userAgent = 'unknown') {
    try {
      const creatorId = user?.id || null;
      data.evaluatedBy = creatorId;

      // Validate that either clientId or loanId is provided
      if (!data.clientId && !data.loanId) {
        throw new Error('Either clientId or loanId (or both) must be provided');
      }

      // Verify client exists if provided
      if (data.clientId) {
        const client = await Client.findByPk(data.clientId);
        if (!client) throw new Error('Client not found');
      }

      // Verify loan exists if provided
      if (data.loanId) {
        const loan = await Loan.findByPk(data.loanId);
        if (!loan) throw new Error('Loan not found');
      }

      const creditScore = await CreditScore.create(data);

      if (!creditScore || !creditScore.id) {
        logger.error('Credit score creation returned invalid result', { creditScore });
        throw new Error('Credit score creation failed: invalid credit score object returned');
      }

      // Log to audit table
      await AuditLogger.log({
        entityType: 'CREDIT_SCORE',
        entityId: creditScore.id,
        action: 'CREATE',
        data,
        actorId: creatorId || 'system',
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      logger.info(
        `Credit score created: id=${creditScore.id} clientId=${creditScore.clientId} loanId=${creditScore.loanId} by user ID ${creatorId}`
      );
      return creditScore;
    } catch (error) {
      logger.error(`Error creating credit score: ${error.message}`);
      throw error;
    }
  },

  // ✅ Get all credit scores
  async getAllCreditScores() {
    try {
      const creditScores = await CreditScore.findAll({
        include: [
          { model: Client, required: false },
          { model: Loan, required: false }
        ]
      });
      logger.info(`Retrieved all credit scores`);
      return creditScores;
    } catch (error) {
      logger.error(`Error fetching credit scores: ${error.message}`);
      throw error;
    }
  },

  // ✅ Get credit scores by client
  async getCreditScoresByClientId(clientId) {
    try {
      const creditScores = await CreditScore.findAll({
        where: { clientId },
        include: [
          { model: Loan, required: false }
        ],
        order: [['createdAt', 'DESC']]
      });
      logger.info(`Retrieved credit scores for client ${clientId}`);
      return creditScores;
    } catch (error) {
      logger.error(`Error fetching credit scores for client ${clientId}: ${error.message}`);
      throw error;
    }
  },

  // ✅ Get credit score by loan
  async getCreditScoreByLoanId(loanId) {
    try {
      const creditScore = await CreditScore.findOne({
        where: { loanId },
        include: [
          { model: Client, required: false },
          { model: Loan, required: false }
        ]
      });
      if (!creditScore) throw new Error('Credit score not found for this loan');
      logger.info(`Retrieved credit score for loan ${loanId}`);
      return creditScore;
    } catch (error) {
      logger.error(`Error fetching credit score for loan ${loanId}: ${error.message}`);
      throw error;
    }
  },

  // ✅ Get single credit score by ID
  async getCreditScoreById(id) {
    try {
      const creditScore = await CreditScore.findByPk(id, {
        include: [
          { model: Client, required: false },
          { model: Loan, required: false }
        ]
      });
      if (!creditScore) throw new Error('Credit score not found');
      logger.info(`Retrieved credit score ID: ${id}`);
      return creditScore;
    } catch (error) {
      logger.error(`Error retrieving credit score ID ${id}: ${error.message}`);
      throw error;
    }
  },

  // ✅ Update credit score
  async updateCreditScore(id, data, updatorId = null, userAgent = 'unknown') {
    try {
      const creditScore = await CreditScore.findByPk(id);
      if (!creditScore) throw new Error('Credit score not found');

      // Validate client exists if being updated
      if (data.clientId) {
        const client = await Client.findByPk(data.clientId);
        if (!client) throw new Error('Client not found');
      }

      // Validate loan exists if being updated
      if (data.loanId) {
        const loan = await Loan.findByPk(data.loanId);
        if (!loan) throw new Error('Loan not found');
      }

      const oldData = creditScore.toJSON();
      await creditScore.update(data);

      // Log to audit table
      await AuditLogger.log({
        entityType: 'CREDIT_SCORE',
        entityId: id,
        action: 'UPDATE',
        data: {
          oldData,
          newData: data
        },
        actorId: updatorId || 'system',
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      logger.info(`Credit score ${id} updated by user ${updatorId}`);
      return creditScore;
    } catch (error) {
      logger.error(`Error updating credit score ${id}: ${error.message}`);
      throw error;
    }
  },

  // ✅ Delete credit score
  async deleteCreditScore(id, deletorId = null, userAgent = 'unknown') {
    try {
      const creditScore = await CreditScore.findByPk(id);
      if (!creditScore) throw new Error('Credit score not found');

      const deletedData = creditScore.toJSON();
      await creditScore.destroy();

      // Log to audit table
      await AuditLogger.log({
        entityType: 'CREDIT_SCORE',
        entityId: id,
        action: 'DELETE',
        data: deletedData,
        actorId: deletorId || 'system',
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      logger.info(`Credit score ${id} deleted by user ${deletorId}`);
      return { success: true, message: 'Credit score deleted successfully' };
    } catch (error) {
      logger.error(`Error deleting credit score ${id}: ${error.message}`);
      throw error;
    }
  }
};

module.exports = creditScoreService;
