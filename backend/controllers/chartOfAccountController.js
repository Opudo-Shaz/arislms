const chartOfAccountService = require('../services/chartOfAccountService');
const logger = require('../config/logger');
const { validateSync } = require('../utils/validationMiddleware');
const { ChartOfAccountRequestDto, ChartOfAccountResponseDto } = require('../dtos/chartOfAccount');

const chartOfAccountController = {
  async getAll(req, res) {
    try {
      const accounts = await chartOfAccountService.getAllAccounts();
      return res.status(200).json({
        success: true,
        data: accounts.map(a => new ChartOfAccountResponseDto(a)),
      });
    } catch (err) {
      logger.error(`GetAllAccounts Error: ${err.message}`);
      return res.status(500).json({ success: false, message: 'Error fetching accounts' });
    }
  },

  async getById(req, res) {
    try {
      const account = await chartOfAccountService.getAccountById(req.params.id);
      return res.status(200).json({ success: true, data: new ChartOfAccountResponseDto(account) });
    } catch (err) {
      logger.error(`GetAccountById Error: ${err.message}`);
      return res.status(404).json({ success: false, message: err.message });
    }
  },

  async create(req, res) {
    try {
      const { valid, errors, value } = validateSync(req.body, ChartOfAccountRequestDto.createSchema);
      if (!valid) return res.status(400).json({ success: false, errors });

      const account = await chartOfAccountService.createAccount(value, req.user?.id);
      return res.status(201).json({ success: true, data: new ChartOfAccountResponseDto(account) });
    } catch (err) {
      logger.error(`CreateAccount Error: ${err.message}`);
      const status = err.message.includes('already exists') ? 409 : 500;
      return res.status(status).json({ success: false, message: err.message });
    }
  },

  async update(req, res) {
    try {
      const { valid, errors, value } = validateSync(req.body, ChartOfAccountRequestDto.updateSchema);
      if (!valid) return res.status(400).json({ success: false, errors });

      const account = await chartOfAccountService.updateAccount(req.params.id, value, req.user?.id);
      return res.status(200).json({ success: true, data: new ChartOfAccountResponseDto(account) });
    } catch (err) {
      logger.error(`UpdateAccount Error: ${err.message}`);
      return res.status(404).json({ success: false, message: err.message });
    }
  },

  async deactivate(req, res) {
    try {
      await chartOfAccountService.deactivateAccount(req.params.id, req.user?.id);
      return res.status(200).json({ success: true, message: 'Account deactivated' });
    } catch (err) {
      logger.error(`DeactivateAccount Error: ${err.message}`);
      return res.status(404).json({ success: false, message: err.message });
    }
  },
};

module.exports = chartOfAccountController;
