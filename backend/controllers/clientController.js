const clientService = require('../services/clientService');
const logger = require('../config/logger');
const { getUserId } = require('../utils/helpers');
const { validateSync } = require('../utils/validationMiddleware');
const ClientResponseDto = require('../dtos/client/ClientResponseDto');
const ClientRequestDto = require('../dtos/client/ClientRequestDto');

const clientController = {
  async createClient(req, res) {
    try {
      const userId = getUserId(req);
      const userAgent = req.headers['user-agent'];
      logger.info(`User ${userId} creating client`);

      // Validate request payload with Joi schema
      const validation = validateSync(req.body, ClientRequestDto.createSchema);
      if (!validation.valid) {
        logger.warn(`Client creation validation failed: ${JSON.stringify(validation.errors)}`);
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validation.errors
        });
      }

      const client = await clientService.createClient(validation.value, req.user, userAgent);

      return res.status(201).json({
        success: true,
        message: 'Client created successfully',
        data: new ClientResponseDto(client)
      });
    } catch (error) {
      logger.error(`Create Client Error: ${error.message}`);

      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },

  async getClients(req, res) {
    try {
      const userId = getUserId(req);
      logger.info(`User ${userId} fetching all clients`);

      const clients = await clientService.getAllClients();
      const result = clients.map(c => new ClientResponseDto(c));

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error(`Get Clients Error: ${error.message}`);

      return res.status(500).json({
        success: false,
        message: 'Unable to fetch clients'
      });
    }
  },

  async getClient(req, res) {
    try {
      const userId = getUserId(req);
      const id = req.params.id;

      logger.info(`User ${userId} fetching client ${id}`);

      const client = await clientService.getClientById(id);

      if (!client) {
        logger.warn(`Client not found: ${id}`);
        return res.status(404).json({
          success: false,
          message: 'Client not found'
        });
      }

      return res.status(200).json({
        success: true,
        data: new ClientResponseDto(client)
      });
    } catch (error) {
      logger.error(`Get Client Error: ${error.message}`);

      return res.status(500).json({
        success: false,
        message: 'Error fetching client'
      });
    }
  },

  async updateClient(req, res) {
    try {
      const userId = getUserId(req);
      const userAgent = req.headers['user-agent'];
      const id = req.params.id;

      logger.info(`User ${userId} updating client ${id}`);

      // Validate request payload with Joi schema
      const validation = validateSync(req.body, ClientRequestDto.updateSchema);
      if (!validation.valid) {
        logger.warn(`Client update validation failed: ${JSON.stringify(validation.errors)}`);
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validation.errors
        });
      }

      const updated = await clientService.updateClient(id, validation.value, userId, userAgent);

      return res.status(200).json({
        success: true,
        message: 'Client updated successfully',
        data: new ClientResponseDto(updated)
      });
    } catch (error) {
      logger.error(`Update Client Error: ${error.message}`);

      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },

  async deleteClient(req, res) {
    try {
      const userId = getUserId(req);
      const userAgent = req.headers['user-agent'];
      const id = req.params.id;

      logger.warn(`User ${userId} deleting client ${id}`);

      const result = await clientService.deleteClient(id, userId, userAgent);

      return res.status(200).json({
        success: true,
        message: 'Client deleted successfully',
        data: new ClientResponseDto(result)
      });
    } catch (error) {
      logger.error(`Delete Client Error: ${error.message}`);

      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },

  async verifyKyc(req, res) {
    try {
      const userId = getUserId(req);
      const userAgent = req.headers['user-agent'];
      const id = req.params.id;
      const { notes } = req.body || {};

      logger.info(`User ${userId} verifying KYC for client ${id}`);
      const client = await clientService.verifyKyc(id, userId, userAgent, notes || null);

      return res.status(200).json({
        success: true,
        message: 'KYC verified successfully. Client is now active.',
        data: new ClientResponseDto(client)
      });
    } catch (error) {
      logger.error(`KYC Verify Error: ${error.message}`);
      return res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
  },

  async requestKycInfo(req, res) {
    try {
      const userId = getUserId(req);
      const userAgent = req.headers['user-agent'];
      const id = req.params.id;
      const { kycNotes } = req.body;

      if (!kycNotes || !String(kycNotes).trim()) {
        return res.status(400).json({ success: false, message: 'kycNotes is required' });
      }

      logger.info(`User ${userId} requesting additional KYC info for client ${id}`);
      const client = await clientService.requestKycInfo(id, String(kycNotes).trim(), userId, userAgent);

      return res.status(200).json({
        success: true,
        message: 'KYC info requested. Client status set to pending re-verification.',
        data: new ClientResponseDto(client)
      });
    } catch (error) {
      logger.error(`KYC Request Info Error: ${error.message}`);
      return res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
  },

  async rejectKyc(req, res) {
    try {
      const userId = getUserId(req);
      const userAgent = req.headers['user-agent'];
      const id = req.params.id;
      const { notes } = req.body || {};

      logger.info(`User ${userId} rejecting KYC for client ${id}`);
      const client = await clientService.rejectKyc(id, userId, userAgent, notes || null);

      return res.status(200).json({
        success: true,
        message: 'KYC rejected. Client status set to KYC failed.',
        data: new ClientResponseDto(client)
      });
    } catch (error) {
      logger.error(`KYC Reject Error: ${error.message}`);
      return res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
  },

  async activateClient(req, res) {
    try {
      const userId = getUserId(req);
      const userAgent = req.headers['user-agent'];
      const id = req.params.id;
      const { notes } = req.body || {};

      logger.info(`User ${userId} activating client ${id}`);
      const client = await clientService.activateClient(id, userId, userAgent, notes || null);

      return res.status(200).json({
        success: true,
        message: 'Client activated successfully.',
        data: new ClientResponseDto(client)
      });
    } catch (error) {
      logger.error(`Activate Client Error: ${error.message}`);
      return res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
  },

  async deactivateClient(req, res) {
    try {
      const userId = getUserId(req);
      const userAgent = req.headers['user-agent'];
      const id = req.params.id;
      const { notes } = req.body || {};

      logger.info(`User ${userId} deactivating client ${id}`);
      const client = await clientService.deactivateClient(id, userId, userAgent, notes || null);

      return res.status(200).json({
        success: true,
        message: 'Client deactivated successfully.',
        data: new ClientResponseDto(client)
      });
    } catch (error) {
      logger.error(`Deactivate Client Error: ${error.message}`);
      return res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
  },

  async suspendClient(req, res) {
    try {
      const userId = getUserId(req);
      const userAgent = req.headers['user-agent'];
      const id = req.params.id;
      const { notes } = req.body || {};

      logger.info(`User ${userId} suspending client ${id}`);
      const client = await clientService.suspendClient(id, userId, userAgent, notes || null);

      return res.status(200).json({
        success: true,
        message: 'Client suspended successfully.',
        data: new ClientResponseDto(client)
      });
    } catch (error) {
      logger.error(`Suspend Client Error: ${error.message}`);
      return res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
  },

  async blacklistClient(req, res) {
    try {
      const userId = getUserId(req);
      const userAgent = req.headers['user-agent'];
      const id = req.params.id;
      const { notes } = req.body || {};

      logger.info(`User ${userId} blacklisting client ${id}`);
      const client = await clientService.blacklistClient(id, userId, userAgent, notes || null);

      return res.status(200).json({
        success: true,
        message: 'Client blacklisted successfully.',
        data: new ClientResponseDto(client)
      });
    } catch (error) {
      logger.error(`Blacklist Client Error: ${error.message}`);
      return res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
  },

  async refreshCreditScore(req, res) {
    try {
      const userId = getUserId(req);
      const userAgent = req.headers['user-agent'];
      const id = req.params.id;

      logger.info(`User ${userId} refreshing credit score for client ${id}`);
      const creditScore = await clientService.refreshCreditScore(id, userId, userAgent);

      return res.status(200).json({
        success: true,
        message: 'Credit score refreshed successfully.',
        data: creditScore
      });
    } catch (error) {
      logger.error(`Refresh Credit Score Error: ${error.message}`);
      return res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
  },
};

module.exports = clientController;
