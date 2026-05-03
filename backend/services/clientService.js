const Client = require('../models/clientModel');
const Loan = require('../models/loanModel');
const CreditScore = require('../models/creditScoreModel');
const { Op } = require('sequelize');
const ClientStatus = require('../enums/clientStatus');
const LoanStatus = require('../enums/loanStatus');
const KycStatus = require('../enums/kycStatus');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');
const AuditLogger = require('../utils/auditLogger');
const creditScoreService = require('./creditScoreService');

const clientService = {
  // ✅ Create client 
  async createClient(data, user, userAgent = 'unknown') {
    try {
      const creatorId = user?.id || null;

      // Uniqueness checks
      const duplicate = await Client.findOne({
        where: {
          [Op.or]: [
            { email: data.email },
            { phone: data.phone },
            { idDocumentNumber: data.idDocumentNumber }
          ]
        }
      });

      if (duplicate) {
        if (duplicate.email === data.email)
          throw Object.assign(new Error('Email is already registered'), { statusCode: 409 });
        if (duplicate.phone === data.phone)
          throw Object.assign(new Error('Phone number is already registered'), { statusCode: 409 });
        if (duplicate.idDocumentNumber === data.idDocumentNumber)
          throw Object.assign(new Error('ID document number is already registered'), { statusCode: 409 });
      }

      // Generate a unique account number (retry on collision)
      let accountNumber;
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = `CL-${uuidv4().split('-')[0].toUpperCase()}`;
        const exists = await Client.findOne({ where: { accountNumber: candidate }, attributes: ['id'] });
        if (!exists) { accountNumber = candidate; break; }
      }
      if (!accountNumber) throw new Error('Failed to generate a unique account number, please try again');

      data.accountNumber = accountNumber;
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
        actorId: creatorId || 1,
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
      const clients = await Client.findAll({
        include: [{
          model: CreditScore,
          as: 'creditScores',
          required: false,
          order: [['created_at', 'DESC']],
          limit: 1,
          separate: true
        }]
      });
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
      const client = await Client.findByPk(id, {
        include: [{
          model: CreditScore,
          as: 'creditScores',
          required: false,
          order: [['created_at', 'DESC']],
          limit: 1,
          separate: true
        }]
      });
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
        actorId: updatorId || 1,
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
        actorId: deletorId || 1,
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

  // ✅ KYC: verify — sets kycStatus=verified, status=active, isActive=true
  async verifyKyc(id, actorId, userAgent = 'unknown', notes = null) {
    try {
      const client = await Client.findByPk(id);
      if (!client) throw Object.assign(new Error('Client not found'), { statusCode: 404 });

      await client.update({
        kycStatus: KycStatus.VERIFIED,
        kycVerifiedAt: new Date(),
        kycNotes: notes,
        verifiedBy: actorId,
        status: ClientStatus.ACTIVE,
        isActive: true
      });

      await AuditLogger.log({
        entityType: 'CLIENT',
        entityId: id,
        action: 'KYC_VERIFY',
        data: { kycStatus: KycStatus.VERIFIED, status: ClientStatus.ACTIVE, notes },
        actorId: actorId || 1,
        options: { actorType: 'USER', source: userAgent }
      });

      logger.info(`Client ID ${id} KYC verified by user ${actorId}`);

      // Run credit scoring after KYC verification
      await this._computeAndSaveCreditScore(id, actorId, userAgent);

      return client;
    } catch (error) {
      logger.error(`Error verifying KYC for client ID ${id}: ${error.message}`);
      throw error;
    }
  },

  // ✅ KYC: request-info — sets kycStatus=in_progress, status=pending_kyc_reverification, stores kycNotes
  async requestKycInfo(id, kycNotes, actorId, userAgent = 'unknown') {
    try {
      const client = await Client.findByPk(id);
      if (!client) throw Object.assign(new Error('Client not found'), { statusCode: 404 });

      await client.update({
        kycStatus: KycStatus.IN_PROGRESS,
        kycNotes,
        status: ClientStatus.PENDING_KYC_REVERIFICATION
      });

      await AuditLogger.log({
        entityType: 'CLIENT',
        entityId: id,
        action: 'KYC_REQUEST_INFO',
        data: { kycStatus: KycStatus.IN_PROGRESS, kycNotes, status: ClientStatus.PENDING_KYC_REVERIFICATION },
        actorId: actorId || 1,
        options: { actorType: 'USER', source: userAgent }
      });

      logger.info(`Client ID ${id} KYC info requested by user ${actorId}`);
      return client;
    } catch (error) {
      logger.error(`Error requesting KYC info for client ID ${id}: ${error.message}`);
      throw error;
    }
  },

  // ✅ KYC: reject — sets kycStatus=rejected, status=kyc_failed, isActive=false
  async rejectKyc(id, actorId, userAgent = 'unknown', notes = null) {
    try {
      const client = await Client.findByPk(id);
      if (!client) throw Object.assign(new Error('Client not found'), { statusCode: 404 });

      await client.update({
        kycStatus: KycStatus.REJECTED,
        status: ClientStatus.KYC_FAILED,
        kycNotes: notes,
        isActive: false
      });

      await AuditLogger.log({
        entityType: 'CLIENT',
        entityId: id,
        action: 'KYC_REJECT',
        data: { kycStatus: KycStatus.REJECTED, status: ClientStatus.KYC_FAILED, notes },
        actorId: actorId || 1,
        options: { actorType: 'USER', source: userAgent }
      });

      logger.info(`Client ID ${id} KYC rejected by user ${actorId}`);
      return client;
    } catch (error) {
      logger.error(`Error rejecting KYC for client ID ${id}: ${error.message}`);
      throw error;
    }
  },

  // ✅ Activate — override to active from any status
  async activateClient(id, actorId, userAgent = 'unknown', notes = null) {
    try {
      const client = await Client.findByPk(id);
      if (!client) throw Object.assign(new Error('Client not found'), { statusCode: 404 });

      await client.update({ status: ClientStatus.ACTIVE, isActive: true });

      await AuditLogger.log({
        entityType: 'CLIENT',
        entityId: id,
        action: 'ACTIVATE',
        data: { status: ClientStatus.ACTIVE, isActive: true, notes },
        actorId: actorId || 1,
        options: { actorType: 'USER', source: userAgent }
      });

      logger.info(`Client ID ${id} activated by user ${actorId}`);
      return client;
    } catch (error) {
      logger.error(`Error activating client ID ${id}: ${error.message}`);
      throw error;
    }
  },

  // Shared helper — delegates to creditScoreService so the logic is reusable
  async _computeAndSaveCreditScore(clientId, actorId, userAgent) {
    try {
      return await creditScoreService.computeAndSave(clientId, actorId, userAgent);
    } catch (err) {
      logger.error(`Error computing credit score for client ${clientId}: ${err.message}`);
    }
  },

  // ✅ Refresh credit score for a client
  async refreshCreditScore(id, actorId, userAgent = 'unknown') {
    const client = await Client.findByPk(id);
    if (!client) throw Object.assign(new Error('Client not found'), { statusCode: 404 });
    return this._computeAndSaveCreditScore(id, actorId, userAgent);
  },

  // Shared guard — throws 409 if the client has an outstanding loan
  async _assertNoActiveLoan(clientId, action) {
    const activeLoan = await Loan.findOne({
      where: {
        clientId,
        status: { [Op.in]: [LoanStatus.DISBURSED, LoanStatus.ACTIVE, LoanStatus.PARTIALLY_PAID, LoanStatus.OVERDUE, LoanStatus.DEFAULTED] }
      }
    });
    if (activeLoan) throw Object.assign(new Error(`Cannot ${action} a client with an active loan`), { statusCode: 409 });
  },

  // ✅ Deactivate — set status=pending, isActive=false
  async deactivateClient(id, actorId, userAgent = 'unknown', notes = null) {
    try {
      const client = await Client.findByPk(id);
      if (!client) throw Object.assign(new Error('Client not found'), { statusCode: 404 });

      await this._assertNoActiveLoan(id, 'deactivate');

      await client.update({ status: ClientStatus.PENDING, isActive: false });

      await AuditLogger.log({
        entityType: 'CLIENT',
        entityId: id,
        action: 'DEACTIVATE',
        data: { status: ClientStatus.PENDING, isActive: false, notes },
        actorId: actorId || 1,
        options: { actorType: 'USER', source: userAgent }
      });

      logger.info(`Client ID ${id} deactivated by user ${actorId}`);
      return client;
    } catch (error) {
      logger.error(`Error deactivating client ID ${id}: ${error.message}`);
      throw error;
    }
  },

  // ✅ Suspend — set status=suspended, isActive=false
  async suspendClient(id, actorId, userAgent = 'unknown', notes = null) {
    try {
      const client = await Client.findByPk(id);
      if (!client) throw Object.assign(new Error('Client not found'), { statusCode: 404 });

      await this._assertNoActiveLoan(id, 'suspend');

      await client.update({ status: ClientStatus.SUSPENDED, isActive: false });

      await AuditLogger.log({
        entityType: 'CLIENT',
        entityId: id,
        action: 'SUSPEND',
        data: { status: ClientStatus.SUSPENDED, isActive: false, notes },
        actorId: actorId || 1,
        options: { actorType: 'USER', source: userAgent }
      });

      logger.info(`Client ID ${id} suspended by user ${actorId}`);
      return client;
    } catch (error) {
      logger.error(`Error suspending client ID ${id}: ${error.message}`);
      throw error;
    }
  },

  // ✅ Blacklist — set status=blacklisted, isActive=false
  async blacklistClient(id, actorId, userAgent = 'unknown', notes = null) {
    try {
      const client = await Client.findByPk(id);
      if (!client) throw Object.assign(new Error('Client not found'), { statusCode: 404 });

      await this._assertNoActiveLoan(id, 'blacklist');

      await client.update({ status: ClientStatus.BLACKLISTED, isActive: false });

      await AuditLogger.log({
        entityType: 'CLIENT',
        entityId: id,
        action: 'BLACKLIST',
        data: { status: ClientStatus.BLACKLISTED, isActive: false, notes },
        actorId: actorId || 1,
        options: { actorType: 'USER', source: userAgent }
      });

      logger.info(`Client ID ${id} blacklisted by user ${actorId}`);
      return client;
    } catch (error) {
      logger.error(`Error blacklisting client ID ${id}: ${error.message}`);
      throw error;
    }
  },
};

module.exports = clientService;
