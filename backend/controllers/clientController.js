const clientService = require('../services/clientService');
const logger = require('../config/logger');
const { getUserId } = require('../utils/helpers');
const { validateSync } = require('../utils/validationMiddleware');
const ClientResponseDTO = require('../dtos/client/ClientResponseDTO');
const ClientRequestDTO = require('../dtos/client/ClientRequestDTO');

const clientController = {
  async createClient(req, res) {
    try {
      const userId = getUserId(req);
      logger.info(`User ${userId} creating client`);

      // Validate request payload with Joi schema
      const validation = validateSync(req.body, ClientRequestDTO.createSchema);
      if (!validation.valid) {
        logger.warn(`Client creation validation failed: ${JSON.stringify(validation.errors)}`);
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validation.errors
        });
      }

      const client = await clientService.createClient(validation.value, req.user);

      return res.status(201).json({
        success: true,
        message: 'Client created successfully',
        data: new ClientResponseDTO(client)
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
      const result = clients.map(c => new ClientResponseDTO(c));

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
        data: new ClientResponseDTO(client)
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
      const id = req.params.id;

      logger.info(`User ${userId} updating client ${id}`);

      // Validate request payload with Joi schema
      const validation = validateSync(req.body, ClientRequestDTO.updateSchema);
      if (!validation.valid) {
        logger.warn(`Client update validation failed: ${JSON.stringify(validation.errors)}`);
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validation.errors
        });
      }

      const updated = await clientService.updateClient(id, validation.value);

      return res.status(200).json({
        success: true,
        message: 'Client updated successfully',
        data: new ClientResponseDTO(updated)
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
      const id = req.params.id;

      logger.warn(`User ${userId} deleting client ${id}`);

      const result = await clientService.deleteClient(id);

      return res.status(200).json({
        success: true,
        message: 'Client deleted successfully',
        data: new ClientResponseDTO(result)
      });
    } catch (error) {
      logger.error(`Delete Client Error: ${error.message}`);

      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },
};

module.exports = clientController;
