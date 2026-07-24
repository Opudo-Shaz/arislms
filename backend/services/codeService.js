const { Code, CodeValue } = require('../models');
const AuditLogger = require('../utils/auditLogger');
const logger = require('../config/logger');

const codeService = {
  // ── Codes ────────────────────────────────────────────────────────────

  async createCode(data, creatorId = null, userAgent = 'unknown') {
    try {
      const existing = await Code.findOne({ where: { key: data.key } });
      if (existing) throw new Error(`Code key '${data.key}' already exists`);

      const newCode = await Code.create({ ...data, createdBy: creatorId });

      await AuditLogger.log({
        entityType: 'CODE',
        entityId: newCode.id,
        action: 'CREATE',
        data,
        actorId: creatorId || 1,
        options: { actorType: 'USER', source: userAgent },
      });

      logger.info(`Code created: id=${newCode.id} key=${newCode.key} by user ${creatorId}`);
      return newCode;
    } catch (error) {
      logger.error(`CodeService.createCode Error: ${error.message}`);
      throw error;
    }
  },

  async getAllCodes({ includeValues = false } = {}) {
    try {
      const codes = await Code.findAll({
        include: includeValues ? [{ model: CodeValue, as: 'values' }] : [],
        order: [['name', 'ASC']],
      });
      return codes;
    } catch (error) {
      logger.error(`CodeService.getAllCodes Error: ${error.message}`);
      throw error;
    }
  },

  async getCodeById(id) {
    try {
      const code = await Code.findByPk(id, { include: [{ model: CodeValue, as: 'values' }] });
      if (!code) throw new Error('Code not found');
      return code;
    } catch (error) {
      logger.error(`CodeService.getCodeById Error: ${error.message}`);
      throw error;
    }
  },

  async getCodeByKey(key, { activeOnly = false } = {}) {
    try {
      const code = await Code.findOne({
        where: { key: key?.toUpperCase() },
        include: [
          {
            model: CodeValue,
            as: 'values',
            where: activeOnly ? { isActive: true } : undefined,
            required: false,
            separate: true,
            order: [['sortOrder', 'ASC']],
          },
        ],
      });
      if (!code) throw new Error('Code not found');
      return code;
    } catch (error) {
      logger.error(`CodeService.getCodeByKey Error: ${error.message}`);
      throw error;
    }
  },

  async updateCode(id, data, updatorId = null, userAgent = 'unknown') {
    try {
      const code = await Code.findByPk(id);
      if (!code) throw new Error('Code not found');

      await code.update({ ...data, modifiedBy: updatorId, modifiedAt: new Date() });

      await AuditLogger.log({
        entityType: 'CODE',
        entityId: id,
        action: 'UPDATE',
        data: { changes: data },
        actorId: updatorId || 1,
        options: { actorType: 'USER', source: userAgent },
      });

      logger.info(`Code updated: id=${id} by user ${updatorId}`);
      return code;
    } catch (error) {
      logger.error(`CodeService.updateCode Error: ${error.message}`);
      throw error;
    }
  },

  async deleteCode(id, actorId = null, userAgent = 'unknown') {
    try {
      const code = await Code.findByPk(id);
      if (!code) throw new Error('Code not found');

      await CodeValue.destroy({ where: { codeId: id } });
      await code.destroy();

      await AuditLogger.log({
        entityType: 'CODE',
        entityId: id,
        action: 'DELETE',
        data: { key: code.key },
        actorId: actorId || 1,
        options: { actorType: 'USER', source: userAgent },
      });

      logger.info(`Code deleted: id=${id} by user ${actorId}`);
      return { id };
    } catch (error) {
      logger.error(`CodeService.deleteCode Error: ${error.message}`);
      throw error;
    }
  },

  // ── Code Values ──────────────────────────────────────────────────────

  async listValuesByCode(codeId, { activeOnly = false } = {}) {
    try {
      const where = { codeId };
      if (activeOnly) where.isActive = true;
      return await CodeValue.findAll({ where, order: [['sortOrder', 'ASC'], ['value', 'ASC']] });
    } catch (error) {
      logger.error(`CodeService.listValuesByCode Error: ${error.message}`);
      throw error;
    }
  },

  async createCodeValue(codeId, data, creatorId = null, userAgent = 'unknown') {
    try {
      const code = await Code.findByPk(codeId);
      if (!code) throw new Error('Code not found');

      const existing = await CodeValue.findOne({ where: { codeId, value: data.value } });
      if (existing) throw new Error(`Value '${data.value}' already exists for this code`);

      const newValue = await CodeValue.create({ ...data, codeId, createdBy: creatorId });

      await AuditLogger.log({
        entityType: 'CODE_VALUE',
        entityId: newValue.id,
        action: 'CREATE',
        data: { codeId, ...data },
        actorId: creatorId || 1,
        options: { actorType: 'USER', source: userAgent },
      });

      logger.info(`CodeValue created: id=${newValue.id} codeId=${codeId} by user ${creatorId}`);
      return newValue;
    } catch (error) {
      logger.error(`CodeService.createCodeValue Error: ${error.message}`);
      throw error;
    }
  },

  async updateCodeValue(id, data, updatorId = null, userAgent = 'unknown') {
    try {
      const codeValue = await CodeValue.findByPk(id);
      if (!codeValue) throw new Error('Code value not found');

      await codeValue.update({ ...data, modifiedBy: updatorId, modifiedAt: new Date() });

      await AuditLogger.log({
        entityType: 'CODE_VALUE',
        entityId: id,
        action: 'UPDATE',
        data: { changes: data },
        actorId: updatorId || 1,
        options: { actorType: 'USER', source: userAgent },
      });

      logger.info(`CodeValue updated: id=${id} by user ${updatorId}`);
      return codeValue;
    } catch (error) {
      logger.error(`CodeService.updateCodeValue Error: ${error.message}`);
      throw error;
    }
  },

  async deleteCodeValue(id, actorId = null, userAgent = 'unknown') {
    try {
      const codeValue = await CodeValue.findByPk(id);
      if (!codeValue) throw new Error('Code value not found');

      await codeValue.destroy();

      await AuditLogger.log({
        entityType: 'CODE_VALUE',
        entityId: id,
        action: 'DELETE',
        data: { value: codeValue.value },
        actorId: actorId || 1,
        options: { actorType: 'USER', source: userAgent },
      });

      logger.info(`CodeValue deleted: id=${id} by user ${actorId}`);
      return { id };
    } catch (error) {
      logger.error(`CodeService.deleteCodeValue Error: ${error.message}`);
      throw error;
    }
  },

  // ── Validation helper — reusable by other controllers/services ────────

  /**
   * Validate that `value` is one of the active values registered under code `key`.
   * @param {string} key - The code key (e.g. 'GENDER')
   * @param {string} value - The submitted value to validate
   * @returns {Promise<boolean>} true if valid, false otherwise (including if code is missing/inactive)
   */
  async validateCodeValue(key, value) {
    try {
      if (!key || value == null) return false;
      const code = await Code.findOne({ where: { key: key.toUpperCase(), isActive: true } });
      if (!code) return false;

      const match = await CodeValue.findOne({
        where: { codeId: code.id, value: String(value), isActive: true },
      });
      return !!match;
    } catch (error) {
      logger.error(`CodeService.validateCodeValue Error: ${error.message}`);
      return false;
    }
  },
};

module.exports = codeService;
