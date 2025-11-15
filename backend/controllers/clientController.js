const clientService = require('../services/clientService');
const logger = require('../config/logger');

const clientController = {
  async createClient(req, res) {
    console.log('Current user details:', req.user);
    try {
      const client = await clientService.createClient(req.body, req.user);
      res.status(201).json(client);
    } catch (error) {
      logger.error(`Controller Error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  },

  async getClients(req, res) {
    try {
      const clients = await clientService.getAllClients();
      res.json(clients);
    } catch (error) {
      logger.error(`Controller Error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  },

  async getClient(req, res) {
    try {
      const client = await clientService.getClientById(req.params.id);
      res.json(client);
    } catch (error) {
      logger.error(`Controller Error: ${error.message}`);
      res.status(404).json({ error: error.message });
    }
  },

  async updateClient(req, res) {
    try {
      const client = await clientService.updateClient(req.params.id, req.body);
      res.json(client);
    } catch (error) {
      logger.error(`Controller Error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  },

  async deleteClient(req, res) {
    try {
      const result = await clientService.deleteClient(req.params.id);
      res.json(result);
    } catch (error) {
      logger.error(`Controller Error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = clientController;
