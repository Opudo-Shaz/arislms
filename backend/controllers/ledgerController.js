const ledgerService = require('../services/ledgerService');
const logger = require('../config/logger');
const { validateSync } = require('../utils/validationMiddleware');
const { JournalEntryRequestDto, JournalEntryResponseDto } = require('../dtos/journalEntry');

const ledgerController = {
  async getAllEntries(req, res) {
    try {
      const { sourceType, from, to, page, limit } = req.query;
      const result = await ledgerService.getAllJournalEntries({
        sourceType,
        fromDate: from,
        toDate: to,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });
      return res.status(200).json({
        success: true,
        ...result,
        entries: result.entries.map(e => new JournalEntryResponseDto(e)),
      });
    } catch (err) {
      logger.error(`GetAllEntries Error: ${err.message}`);
      return res.status(500).json({ success: false, message: 'Error fetching journal entries' });
    }
  },

  async createManualEntry(req, res) {
    try {
      const { valid, errors, value } = validateSync(req.body, JournalEntryRequestDto.createSchema);
      if (!valid) return res.status(400).json({ success: false, errors });

      const { entry } = await ledgerService.postEntry({
        ...value,
        createdBy: req.user?.id,
        source: req.headers['user-agent'] || 'api',
      });

      // Reload entry with lines
      const JournalEntry = require('../models/journalEntryModel');
      const full = await JournalEntry.findByPk(entry.id, {
        include: [{ association: 'lines', include: [{ association: 'account' }] }],
      });

      return res.status(201).json({ success: true, data: new JournalEntryResponseDto(full) });
    } catch (err) {
      logger.error(`CreateManualEntry Error: ${err.message}`);
      const status = err.message.includes('not balanced') || err.message.includes('not found') ? 400 : 500;
      return res.status(status).json({ success: false, message: err.message });
    }
  },

  async reverseEntry(req, res) {
    try {
      const { id } = req.params;
      const { description } = req.body;
      const { original, reversal } = await ledgerService.reverseEntry(
        parseInt(id, 10),
        description,
        req.user?.id,
        req.headers['user-agent'] || 'api'
      );

      const JournalEntry = require('../models/journalEntryModel');
      const full = await JournalEntry.findByPk(reversal.id, {
        include: [{ association: 'lines', include: [{ association: 'account' }] }],
      });

      return res.status(200).json({
        success: true,
        data: {
          original: { id: original.id, reference: original.reference, status: original.status },
          reversal: new JournalEntryResponseDto(full),
        },
      });
    } catch (err) {
      logger.error(`ReverseEntry Error: ${err.message}`);
      const status = err.message.includes('not found') || err.message.includes('Only POSTED') ? 400 : 500;
      return res.status(status).json({ success: false, message: err.message });
    }
  },

  async getTrialBalance(req, res) {
    try {
      const { asOf } = req.query;
      const result = await ledgerService.getTrialBalance(asOf);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      logger.error(`GetTrialBalance Error: ${err.message}`);
      return res.status(500).json({ success: false, message: 'Error generating trial balance' });
    }
  },

  async getAccountStatement(req, res) {
    try {
      const { code } = req.params;
      const { from, to } = req.query;
      const result = await ledgerService.getAccountStatement(code, from, to);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      logger.error(`GetAccountStatement Error: ${err.message}`);
      const status = err.message.includes('not found') ? 404 : 500;
      return res.status(status).json({ success: false, message: err.message });
    }
  },

  async getIncomeSummary(req, res) {
    try {
      const { from, to } = req.query;
      const result = await ledgerService.getIncomeSummary(from, to);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      logger.error(`GetIncomeSummary Error: ${err.message}`);
      return res.status(500).json({ success: false, message: 'Error generating income summary' });
    }
  },

  async getAvailableFunds(req, res) {
    try {
      const result = await ledgerService.getAvailableFunds();
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      logger.error(`GetAvailableFunds Error: ${err.message}`);
      return res.status(500).json({ success: false, message: 'Error fetching available funds' });
    }
  },
};

module.exports = ledgerController;
