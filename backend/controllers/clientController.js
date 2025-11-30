const clientService = require('../services/clientService');
const logger = require('../config/logger');
const { getUserId } = require('../utils/helpers');

const clientController = {
  async createClient(req, res) {
    try {
      const userId = getUserId(req);

      logger.info(`User ${userId} creating client`);

      const client = await clientService.createClient(req.body, req.user);

      return res.status(201).json({
        success: true,
        message: 'Client created successfully',
        data: client
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

      return res.status(200).json({
        success: true,
        data: clients
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
        data: client
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

      const updated = await clientService.updateClient(id, req.body);

      return res.status(200).json({
        success: true,
        message: 'Client updated successfully',
        data: updated
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
        data: result
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
