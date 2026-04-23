const { Op } = require('sequelize');
const ChartOfAccount = require('../models/chartOfAccountModel');
const logger = require('../config/logger');
const AuditLogger = require('../utils/auditLogger');

const chartOfAccountService = {
  async getAllAccounts() {
    return ChartOfAccount.findAll({
      where: { isActive: true },
      include: [{ association: 'subAccounts', required: false }],
      order: [['code', 'ASC']],
    });
  },

  async getAccountById(id) {
    const account = await ChartOfAccount.findByPk(id, {
      include: [
        { association: 'parentAccount', required: false },
        { association: 'subAccounts', required: false },
      ],
    });
    if (!account) throw new Error(`Account with id ${id} not found`);
    return account;
  },

  async getAccountByCode(code) {
    const account = await ChartOfAccount.findOne({ where: { code } });
    if (!account) throw new Error(`Account with code '${code}' not found`);
    return account;
  },

  async createAccount(data, createdBy) {
    const existing = await ChartOfAccount.findOne({ where: { code: data.code } });
    if (existing) throw new Error(`Account code '${data.code}' already exists`);

    const account = await ChartOfAccount.create({ ...data, createdBy });

    await AuditLogger.log({
      entityType: 'CHART_OF_ACCOUNT',
      entityId: account.id,
      action: 'CREATE',
      data: { code: account.code, name: account.name, type: account.type },
      actorId: createdBy || AuditLogger.SYSTEM_USER_ID,
      options: { actorType: 'USER' },
    });

    return account;
  },

  async updateAccount(id, data, actorId) {
    const account = await ChartOfAccount.findByPk(id);
    if (!account) throw new Error(`Account with id ${id} not found`);

    const before = { code: account.code, name: account.name, isActive: account.isActive };
    await account.update(data);

    await AuditLogger.log({
      entityType: 'CHART_OF_ACCOUNT',
      entityId: id,
      action: 'UPDATE',
      data: { before, after: data },
      actorId: actorId || AuditLogger.SYSTEM_USER_ID,
      options: { actorType: 'USER' },
    });

    return account;
  },

  async deactivateAccount(id, actorId) {
    const account = await ChartOfAccount.findByPk(id);
    if (!account) throw new Error(`Account with id ${id} not found`);

    await account.update({ isActive: false });

    await AuditLogger.log({
      entityType: 'CHART_OF_ACCOUNT',
      entityId: id,
      action: 'DELETE',
      data: { code: account.code, name: account.name, deactivated: true },
      actorId: actorId || AuditLogger.SYSTEM_USER_ID,
      options: { actorType: 'USER' },
    });

    return account;
  },

  /**
   * Returns the running balance of an account as of a given date.
   * For DEBIT-normal accounts: balance = sum(debit) - sum(credit)
   * For CREDIT-normal accounts: balance = sum(credit) - sum(debit)
   */
  async getAccountBalance(code, asOfDate) {
    const account = await this.getAccountByCode(code);

    const JournalEntryLine = require('../models/journalEntryLineModel');
    const JournalEntry = require('../models/journalEntryModel');
    const JournalEntryStatus = require('../enums/journalEntryStatus');

    const dateFilter = asOfDate ? { [Op.lte]: new Date(asOfDate) } : undefined;

    const lines = await JournalEntryLine.findAll({
      where: { accountId: account.id },
      include: [{
        model: JournalEntry,
        where: {
          status: JournalEntryStatus.POSTED,
          ...(dateFilter ? { entryDate: dateFilter } : {}),
        },
        required: true,
      }],
    });

    const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit), 0);

    const balance = account.normalBalance === 'DEBIT'
      ? totalDebit - totalCredit
      : totalCredit - totalDebit;

    return {
      account,
      totalDebit: Number(totalDebit.toFixed(2)),
      totalCredit: Number(totalCredit.toFixed(2)),
      balance: Number(balance.toFixed(2)),
    };
  },
};

module.exports = chartOfAccountService;
