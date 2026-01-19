const Client = require('../models/clientModel');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');
const AuditLogger = require('../utils/auditLogger');

const clientService = {
  // ✅ Create client 
  async createClient(data, user, userAgent = 'unknown') {
    try {
      const creatorId = user?.id || null;
      data.accountNumber = `CL-${uuidv4().split('-')[0].toUpperCase()}`;
      data.createdBy = creatorId;

      const client = await Client.create(data);

      // Validate the created client before logging
      if (!client || !client.id) {
        logger.error('Client creation returned invalid result', { client });
        throw new Error('Client creation failed: invalid client object returned');
      }

      // Log to audit table after successful creation
      await AuditLogger.log({
        entityType: 'CLIENT',
        entityId: client.id,
        action: 'CREATE',
        data,
        actorId: creatorId || 'system',
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      logger.info(`Client created: ${client.accountNumber} by user ID ${creatorId}`);
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
  async updateClient(id, data, updatorId = null, userAgent = 'unknown') {
    try {
      const client = await Client.findByPk(id);
      if (!client) throw new Error('Client not found');

      const oldData = client.toJSON();
      await client.update(data);

      // Log to audit table after successful update
      await AuditLogger.log({
        entityType: 'CLIENT',
        entityId: id,
        action: 'UPDATE',
        data: { changes: data },
        actorId: updatorId || 'system',
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      logger.info(`Client ID ${id} was updated by user ${updatorId}`);
      return client;
    } catch (error) {
      logger.error(`Error updating client ID ${id}: ${error.message}`);
      throw error;
    }
  },

  // ✅ Delete client (admin only)
  async deleteClient(id, deletorId = null, userAgent = 'unknown') {
    try {
      const client = await Client.findByPk(id);
      if (!client) throw new Error('Client not found');

      const deletedData = client.toJSON();
      await client.destroy();

      // Log to audit table after successful deletion
      await AuditLogger.log({
        entityType: 'CLIENT',
        entityId: id,
        action: 'DELETE',
        data: deletedData,
        actorId: deletorId || 'system',
        options: {
          actorType: 'USER',
          source: userAgent
        }
      });

      logger.info(`Client ID ${id} was deleted by user ${deletorId}`);
      return { message: 'Client deleted successfully', id };
    } catch (error) {
      logger.error(`Error deleting client ID ${id}: ${error.message}`);
      throw error;
    }
  },
};

module.exports = clientService;
