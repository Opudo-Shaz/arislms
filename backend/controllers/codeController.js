const codeService = require('../services/codeService');
const { CodeRequestDto, CodeResponseDto } = require('../dtos/code');
const { CodeValueRequestDto, CodeValueResponseDto } = require('../dtos/codeValue');
const logger = require('../config/logger');

class CodeController {
  // ── Codes ────────────────────────────────────────────────────────────

  static async createCode(req, res) {
    try {
      const { error, value } = CodeRequestDto.createSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          error: error.details.map((detail) => detail.message),
        });
      }

      const userId = req.user?.id || null;
      const userAgent = req.headers['user-agent'] || 'unknown';

      const newCode = await codeService.createCode(value, userId, userAgent);
      const responseDto = CodeResponseDto.fromModel(newCode);

      return res.status(201).json({
        success: true,
        message: 'Code created successfully',
        data: responseDto,
      });
    } catch (error) {
      logger.error('Error creating code:', error);
      const status = error.message.includes('already exists') ? 409 : 500;
      return res.status(status).json({
        success: false,
        message: error.message,
        error: error.message,
      });
    }
  }

  static async getAllCodes(req, res) {
    try {
      const includeValues = req.query.includeValues === 'true';
      const codes = await codeService.getAllCodes({ includeValues });
      const responseDtos = CodeResponseDto.fromModels(codes);

      return res.status(200).json({
        success: true,
        data: responseDtos,
      });
    } catch (error) {
      logger.error('Error fetching codes:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching codes',
        error: error.message,
      });
    }
  }

  static async getCodeById(req, res) {
    try {
      const { id } = req.params;
      const code = await codeService.getCodeById(id);
      const responseDto = CodeResponseDto.fromModel(code);

      return res.status(200).json({
        success: true,
        data: responseDto,
      });
    } catch (error) {
      logger.error('Error fetching code:', error);
      return res.status(error.message === 'Code not found' ? 404 : 500).json({
        success: false,
        message: error.message,
        error: error.message,
      });
    }
  }

  static async getCodeByKey(req, res) {
    try {
      const { key } = req.params;
      const activeOnly = req.query.activeOnly === 'true';
      const code = await codeService.getCodeByKey(key, { activeOnly });
      const responseDto = CodeResponseDto.fromModel(code);

      return res.status(200).json({
        success: true,
        data: responseDto,
      });
    } catch (error) {
      logger.error('Error fetching code by key:', error);
      return res.status(error.message === 'Code not found' ? 404 : 500).json({
        success: false,
        message: error.message,
        error: error.message,
      });
    }
  }

  static async updateCode(req, res) {
    try {
      const { error, value } = CodeRequestDto.updateSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          error: error.details.map((detail) => detail.message),
        });
      }

      const { id } = req.params;
      const userId = req.user?.id || null;
      const userAgent = req.headers['user-agent'] || 'unknown';

      const updatedCode = await codeService.updateCode(id, value, userId, userAgent);
      const responseDto = CodeResponseDto.fromModel(updatedCode);

      return res.status(200).json({
        success: true,
        message: 'Code updated successfully',
        data: responseDto,
      });
    } catch (error) {
      logger.error('Error updating code:', error);
      return res.status(error.message === 'Code not found' ? 404 : 500).json({
        success: false,
        message: error.message,
        error: error.message,
      });
    }
  }

  static async deleteCode(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || null;
      const userAgent = req.headers['user-agent'] || 'unknown';

      const result = await codeService.deleteCode(id, userId, userAgent);

      return res.status(200).json({
        success: true,
        message: 'Code deleted successfully',
        data: result,
      });
    } catch (error) {
      logger.error('Error deleting code:', error);
      return res.status(error.message === 'Code not found' ? 404 : 500).json({
        success: false,
        message: error.message,
        error: error.message,
      });
    }
  }

  // ── Code Values ──────────────────────────────────────────────────────

  static async listCodeValues(req, res) {
    try {
      const { codeId } = req.params;
      const activeOnly = req.query.activeOnly === 'true';
      const values = await codeService.listValuesByCode(codeId, { activeOnly });
      const responseDtos = CodeValueResponseDto.fromModels(values);

      return res.status(200).json({
        success: true,
        data: responseDtos,
      });
    } catch (error) {
      logger.error('Error fetching code values:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching code values',
        error: error.message,
      });
    }
  }

  static async createCodeValue(req, res) {
    try {
      const { error, value } = CodeValueRequestDto.createSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          error: error.details.map((detail) => detail.message),
        });
      }

      const { codeId } = req.params;
      const userId = req.user?.id || null;
      const userAgent = req.headers['user-agent'] || 'unknown';

      const newValue = await codeService.createCodeValue(codeId, value, userId, userAgent);
      const responseDto = CodeValueResponseDto.fromModel(newValue);

      return res.status(201).json({
        success: true,
        message: 'Code value created successfully',
        data: responseDto,
      });
    } catch (error) {
      logger.error('Error creating code value:', error);
      const status = error.message.includes('already exists') ? 409
        : error.message === 'Code not found' ? 404 : 500;
      return res.status(status).json({
        success: false,
        message: error.message,
        error: error.message,
      });
    }
  }

  static async updateCodeValue(req, res) {
    try {
      const { error, value } = CodeValueRequestDto.updateSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          error: error.details.map((detail) => detail.message),
        });
      }

      const { valueId } = req.params;
      const userId = req.user?.id || null;
      const userAgent = req.headers['user-agent'] || 'unknown';

      const updatedValue = await codeService.updateCodeValue(valueId, value, userId, userAgent);
      const responseDto = CodeValueResponseDto.fromModel(updatedValue);

      return res.status(200).json({
        success: true,
        message: 'Code value updated successfully',
        data: responseDto,
      });
    } catch (error) {
      logger.error('Error updating code value:', error);
      return res.status(error.message === 'Code value not found' ? 404 : 500).json({
        success: false,
        message: error.message,
        error: error.message,
      });
    }
  }

  static async deleteCodeValue(req, res) {
    try {
      const { valueId } = req.params;
      const userId = req.user?.id || null;
      const userAgent = req.headers['user-agent'] || 'unknown';

      const result = await codeService.deleteCodeValue(valueId, userId, userAgent);

      return res.status(200).json({
        success: true,
        message: 'Code value deleted successfully',
        data: result,
      });
    } catch (error) {
      logger.error('Error deleting code value:', error);
      return res.status(error.message === 'Code value not found' ? 404 : 500).json({
        success: false,
        message: error.message,
        error: error.message,
      });
    }
  }

  // ── Validation ───────────────────────────────────────────────────────

  static async validate(req, res) {
    try {
      const { key } = req.params;
      const { value } = req.body;

      const valid = await codeService.validateCodeValue(key, value);

      return res.status(200).json({
        success: true,
        data: { valid },
      });
    } catch (error) {
      logger.error('Error validating code value:', error);
      return res.status(500).json({
        success: false,
        message: 'Error validating code value',
        error: error.message,
      });
    }
  }
}

module.exports = CodeController;
