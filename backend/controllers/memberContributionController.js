const memberContributionService = require('../services/memberContributionService');
const logger = require('../config/logger');
const { validateSync } = require('../utils/validationMiddleware');
const { MemberContributionRequestDto, MemberContributionResponseDto } = require('../dtos/memberContribution');
const ContributionType = require('../enums/contributionType');

const memberContributionController = {
  async getAll(req, res) {
    try {
      const records = await memberContributionService.getAllContributions();
      return res.status(200).json({
        success: true,
        data: records.map(r => new MemberContributionResponseDto(r)),
      });
    } catch (err) {
      logger.error(`GetAllContributions Error: ${err.message}`);
      return res.status(500).json({ success: false, message: 'Error fetching contributions' });
    }
  },

  async getByMember(req, res) {
    try {
      const { clientId } = req.params;
      const result = await memberContributionService.getContributionsByMember(clientId);
      return res.status(200).json({
        success: true,
        data: {
          client: result.client,
          totalContributions: result.totalContributions,
          totalWithdrawals: result.totalWithdrawals,
          netBalance: result.netBalance,
          records: result.records.map(r => new MemberContributionResponseDto(r)),
        },
      });
    } catch (err) {
      logger.error(`GetContributionsByMember Error: ${err.message}`);
      const status = err.message.includes('not found') ? 404 : 500;
      return res.status(status).json({ success: false, message: err.message });
    }
  },

  async create(req, res) {
    try {
      const { valid, errors, value } = validateSync(req.body, MemberContributionRequestDto.createSchema);
      if (!valid) return res.status(400).json({ success: false, errors });

      const isWithdrawal = value.type === ContributionType.WITHDRAWAL;
      const source = req.headers['user-agent'] || 'api';
      const record = isWithdrawal
        ? await memberContributionService.recordWithdrawal(value, req.user?.id, source)
        : await memberContributionService.recordContribution(value, req.user?.id, source);

      return res.status(201).json({ success: true, data: new MemberContributionResponseDto(record) });
    } catch (err) {
      logger.error(`CreateContribution Error: ${err.message}`);
      const status = err.message.includes('not found') ? 404
        : err.message.includes('exceeds') ? 422 : 500;
      return res.status(status).json({ success: false, message: err.message });
    }
  },
};

module.exports = memberContributionController;
