const Client = require('../models/clientModel');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

const clientService = {
  // ✅ Create client 
  async createClient(data, user) {
    try {
      data.referenceCode = `CL-${uuidv4().split('-')[0].toUpperCase()}`;
      data.createdBy = getUserId({ user });

      const client = await Client.create(data);
      logger.info(`Client created: ${client.referenceCode} by Admin ID ${adminUser.id}`);
      return client;
    } catch (error) {
      logger.error(`Error creating client: ${error.message}`);
      throw error;
    }
  },

  // ✅ Get all clients 
  async getAllClients() {
    try {
      const clients = await Client.findAll();
      logger.info(`Retrieved all clients`);
      return clients;
    } catch (error) {
      logger.error(`Error fetching clients: ${error.message}`);
      throw error;
    }
  },

  // ✅ Get single client by ID (any authenticated user, but only admin can see all)
  async getClientById(id) {
    try {
      const client = await Client.findByPk(id);
      if (!client) throw new Error('Client not found');
      logger.info(`Retrieved client ID: ${id}`);
      return client;
    } catch (error) {
      logger.error(`Error retrieving client ID ${id}: ${error.message}`);
      throw error;
    }
  },

  // ✅ Update client (admin only)
  async updateClient(id, data) {
    try {
      const client = await Client.findByPk(id);
      if (!client) throw new Error('Client not found');

      await client.update(data);
      logger.info(`Client ID ${id} was updated`);
      return client;
    } catch (error) {
      logger.error(`Error updating client ID ${id}: ${error.message}`);
      throw error;
    }
  },

  // ✅ Delete client (admin only)
  async deleteClient(id) {
    try {
      const client = await Client.findByPk(id);
      if (!client) throw new Error('Client not found');

      await client.destroy();
      logger.info(`Client ID ${id} was deleted`);
      return { message: 'Client deleted successfully', id };
    } catch (error) {
      logger.error(`Error deleting client ID ${id}: ${error.message}`);
      throw error;
    }
  },
};

module.exports = clientService;
