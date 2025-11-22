const clientService = require('../services/clientService');
const logger = require('../config/logger');

const clientController = {
  async createClient(req, res) {
    try {
      const user = req.user;

      logger.info(`User ${user.id} creating client`);

      const client = await clientService.createClient(req.body, user);

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
      logger.info(`User ${req.user.id} fetching all clients`);

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
      const id = req.params.id;

      logger.info(`User ${req.user.id} fetching client ${id}`);

      const client = await clientService.getClientById(id);

      if (!client) {
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

      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
  },

  async updateClient(req, res) {
    try {
      const id = req.params.id;

      logger.info(`User ${req.user.id} updating client ${id}`);

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
      const id = req.params.id;

      logger.warn(`User ${req.user.id} deleting client ${id}`);

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
