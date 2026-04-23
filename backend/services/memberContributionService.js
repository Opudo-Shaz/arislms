const sequelize = require('../config/sequalize_db');
const MemberContribution = require('../models/memberContributionModel');
const Client = require('../models/clientModel');
const ledgerService = require('./ledgerService');
const ContributionType = require('../enums/contributionType');
const logger = require('../config/logger');
const AuditLogger = require('../utils/auditLogger');

const memberContributionService = {
  async recordContribution(data, createdBy, source) {
    const t = await sequelize.transaction();
    try {
      const client = await Client.findByPk(data.clientId, { transaction: t });
      if (!client) throw new Error(`Client ${data.clientId} not found`);

      const amount = Number(data.amount);
      if (!amount || amount <= 0) throw new Error('Amount must be greater than zero');

      const entryDate = data.contributionDate || new Date().toISOString().split('T')[0];

      // Post journal entry: DR 1001 Cash / CR 3001 Member Contributions
      const { entry } = await ledgerService.postEntry({
        entryDate,
        description: `Member contribution – ${client.firstName} ${client.lastName}`,
        sourceType: 'CONTRIBUTION',
        createdBy,
        source,
        lines: [
          {
            accountCode: '1001',
            debit: amount,
            description: `Cash received from ${client.firstName} ${client.lastName}`,
            clientId: data.clientId,
          },
          {
            accountCode: '3001',
            credit: amount,
            description: `Member contribution – ${client.firstName} ${client.lastName}`,
            clientId: data.clientId,
          },
        ],
      }, t);

      const contribution = await MemberContribution.create({
        clientId: data.clientId,
        amount,
        contributionDate: entryDate,
        type: ContributionType.CONTRIBUTION,
        notes: data.notes || null,
        journalEntryId: entry.id,
        createdBy,
      }, { transaction: t });

      await t.commit();
      logger.info(`Contribution recorded: client ${data.clientId}, amount ${amount}, entry ${entry.reference}`);

      await AuditLogger.log({
        entityType: 'MEMBER_CONTRIBUTION',
        entityId: contribution.id,
        action: 'CREATE',
        data: { clientId: data.clientId, amount, type: ContributionType.CONTRIBUTION, journalEntryId: entry.id },
        actorId: createdBy || AuditLogger.SYSTEM_USER_ID,
        options: { actorType: 'USER', source: source || 'system' },
      });

      return contribution;

    } catch (err) {
      await t.rollback();
      logger.error(`Error recording contribution: ${err.message}`);
      throw err;
    }
  },

  async recordWithdrawal(data, createdBy, source) {
    const t = await sequelize.transaction();
    try {
      const client = await Client.findByPk(data.clientId, { transaction: t });
      if (!client) throw new Error(`Client ${data.clientId} not found`);

      const amount = Number(data.amount);
      if (!amount || amount <= 0) throw new Error('Amount must be greater than zero');

      // Check member has sufficient equity balance before withdrawing
      const memberBalance = await this.getMemberBalance(data.clientId);
      if (memberBalance.netBalance < amount) {
        throw new Error(
          `Withdrawal amount (${amount}) exceeds member net balance (${memberBalance.netBalance})`
        );
      }

      const entryDate = data.contributionDate || new Date().toISOString().split('T')[0];

      // Post journal entry: DR 3001 Member Contributions / CR 1001 Cash
      const { entry } = await ledgerService.postEntry({
        entryDate,
        description: `Member withdrawal – ${client.firstName} ${client.lastName}`,
        sourceType: 'CONTRIBUTION',
        createdBy,
        source,
        lines: [
          {
            accountCode: '3001',
            debit: amount,
            description: `Member withdrawal – ${client.firstName} ${client.lastName}`,
            clientId: data.clientId,
          },
          {
            accountCode: '1001',
            credit: amount,
            description: `Cash paid to ${client.firstName} ${client.lastName}`,
            clientId: data.clientId,
          },
        ],
      }, t);

      const contribution = await MemberContribution.create({
        clientId: data.clientId,
        amount,
        contributionDate: entryDate,
        type: ContributionType.WITHDRAWAL,
        notes: data.notes || null,
        journalEntryId: entry.id,
        createdBy,
      }, { transaction: t });

      await t.commit();
      logger.info(`Withdrawal recorded: client ${data.clientId}, amount ${amount}, entry ${entry.reference}`);

      await AuditLogger.log({
        entityType: 'MEMBER_CONTRIBUTION',
        entityId: contribution.id,
        action: 'CREATE',
        data: { clientId: data.clientId, amount, type: ContributionType.WITHDRAWAL, journalEntryId: entry.id },
        actorId: createdBy || AuditLogger.SYSTEM_USER_ID,
        options: { actorType: 'USER', source: source || 'system' },
      });

      return contribution;

    } catch (err) {
      await t.rollback();
      logger.error(`Error recording withdrawal: ${err.message}`);
      throw err;
    }
  },

  /**
   * Returns a member's net equity balance (contributions minus withdrawals).
   */
  async getMemberBalance(clientId) {
    const records = await MemberContribution.findAll({ where: { clientId } });

    const totalContributions = records
      .filter(r => r.type === ContributionType.CONTRIBUTION)
      .reduce((s, r) => s + Number(r.amount), 0);

    const totalWithdrawals = records
      .filter(r => r.type === ContributionType.WITHDRAWAL)
      .reduce((s, r) => s + Number(r.amount), 0);

    return {
      clientId,
      totalContributions: Number(totalContributions.toFixed(2)),
      totalWithdrawals: Number(totalWithdrawals.toFixed(2)),
      netBalance: Number((totalContributions - totalWithdrawals).toFixed(2)),
    };
  },

  async getAllContributions() {
    return MemberContribution.findAll({
      include: [{ association: 'client' }, { association: 'journalEntry' }],
      order: [['contribution_date', 'DESC']],
    });
  },

  async getContributionsByMember(clientId) {
    const client = await Client.findByPk(clientId);
    if (!client) throw new Error(`Client ${clientId} not found`);

    const records = await MemberContribution.findAll({
      where: { clientId },
      include: [{ association: 'journalEntry' }],
      order: [['contribution_date', 'DESC']],
    });

    const balance = await this.getMemberBalance(clientId);

    return { client, records, ...balance };
  },
};

module.exports = memberContributionService;
