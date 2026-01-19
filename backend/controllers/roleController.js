const roleService = require('../services/roleService');
const { RoleRequestDto, RoleResponseDto } = require('../dtos/role');
const logger = require('../config/logger');

class RoleController {
  /**
   * Create a new role
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  static async createRole(req, res) {
    try {
      const { error, value } = RoleRequestDto.createSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          error: error.details.map(detail => detail.message),
        });
      }

      const userId = req.user?.id || null;
      const userAgent = req.headers['user-agent'] || 'unknown';

      const newRole = await roleService.createRole(value, userId, userAgent);
      const responseDto = RoleResponseDto.fromModel(newRole);

      return res.status(201).json({
        success: true,
        message: 'Role created successfully',
        data: responseDto,
      });
    } catch (error) {
      logger.error('Error creating role:', error);
      return res.status(500).json({
        success: false,
        message: 'Error creating role',
        error: error.message,
      });
    }
  }

  /**
   * Get all roles
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  static async getAllRoles(req, res) {
    try {
      const roles = await roleService.getAllRoles();
      const responseDtos = RoleResponseDto.fromModels(roles);

      return res.status(200).json({
        success: true,
        data: responseDtos,
      });
    } catch (error) {
      logger.error('Error fetching roles:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching roles',
        error: error.message,
      });
    }
  }

  /**
   * Get role by ID
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  static async getRoleById(req, res) {
    try {
      const { id } = req.params;
      const role = await roleService.getRoleById(id);
      const responseDto = RoleResponseDto.fromModel(role);

      return res.status(200).json({
        success: true,
        data: responseDto,
      });
    } catch (error) {
      logger.error('Error fetching role:', error);
      return res.status(error.message === 'Role not found' ? 404 : 500).json({
        success: false,
        message: error.message,
        error: error.message,
      });
    }
  }

  /**
   * Update role
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  static async updateRole(req, res) {
    try {
      const { error, value } = RoleRequestDto.updateSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          error: error.details.map(detail => detail.message),
        });
      }

      const { id } = req.params;
      const userId = req.user?.id || null;
      const userAgent = req.headers['user-agent'] || 'unknown';

      const updatedRole = await roleService.updateRole(id, value, userId, userAgent);
      const responseDto = RoleResponseDto.fromModel(updatedRole);

      return res.status(200).json({
        success: true,
        message: 'Role updated successfully',
        data: responseDto,
      });
    } catch (error) {
      logger.error('Error updating role:', error);
      return res.status(error.message === 'Role not found' ? 404 : 500).json({
        success: false,
        message: error.message,
        error: error.message,
      });
    }
  }

  /**
   * Add permission to role
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  static async addPermission(req, res) {
    try {
      const { id } = req.params;
      const { permission } = req.body;

      if (!permission || typeof permission !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Permission is required and must be a string',
        });
      }

      const userId = req.user?.id || null;
      const userAgent = req.headers['user-agent'] || 'unknown';

      const updatedRole = await roleService.addPermission(id, permission, userId, userAgent);
      const responseDto = RoleResponseDto.fromModel(updatedRole);

      return res.status(200).json({
        success: true,
        message: 'Permission added successfully',
        data: responseDto,
      });
    } catch (error) {
      logger.error('Error adding permission:', error);
      return res.status(error.message === 'Role not found' ? 404 : 500).json({
        success: false,
        message: error.message,
        error: error.message,
      });
    }
  }

  /**
   * Remove permission from role
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  static async removePermission(req, res) {
    try {
      const { id } = req.params;
      const { permission } = req.body;

      if (!permission || typeof permission !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Permission is required and must be a string',
        });
      }

      const userId = req.user?.id || null;
      const userAgent = req.headers['user-agent'] || 'unknown';

      const updatedRole = await roleService.removePermission(id, permission, userId, userAgent);
      const responseDto = RoleResponseDto.fromModel(updatedRole);

      return res.status(200).json({
        success: true,
        message: 'Permission removed successfully',
        data: responseDto,
      });
    } catch (error) {
      logger.error('Error removing permission:', error);
      return res.status(error.message === 'Role not found' ? 404 : 500).json({
        success: false,
        message: error.message,
        error: error.message,
      });
    }
  }

  /**
   * Delete role
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  static async deleteRole(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || null;
      const userAgent = req.headers['user-agent'] || 'unknown';

      const result = await roleService.deleteRole(id, userId, userAgent);

      return res.status(200).json({
        success: true,
        message: 'Role deleted successfully',
        data: result,
      });
    } catch (error) {
      logger.error('Error deleting role:', error);
      return res.status(error.message === 'Role not found' ? 404 : 500).json({
        success: false,
        message: error.message,
        error: error.message,
      });
    }
  }
}

module.exports = RoleController;
