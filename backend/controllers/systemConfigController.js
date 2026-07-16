const Joi = require('joi')
const service = require('../services/systemConfigService')
const logger = require('../config/logger')
const { getUserId } = require('../utils/helpers')

const CATEGORIES = (process.env.SYSTEM_CONFIG_CATEGORIES || 'general,storage,notifications,loans,integrations,email')
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean)

const createSchema = Joi.object({
  key: Joi.string().trim().lowercase().pattern(/^[a-z0-9_.]+$/).max(100).required()
    .messages({ 'string.pattern.base': 'Key must be lowercase letters, digits, dots, or underscores' }),
  label: Joi.string().trim().max(200).required(),
  isBoolean: Joi.boolean().default(false),
  // value required only when isBoolean is false
  value: Joi.when('isBoolean', {
    is: true,
    then: Joi.string().allow('', null).optional(),
    otherwise: Joi.string().trim().min(1).required().messages({
      'string.empty': 'Value is required for non-boolean configs',
      'any.required': 'Value is required for non-boolean configs',
    }),
  }),
  category: Joi.string().valid(...CATEGORIES).default('general'),
  description: Joi.string().allow('', null).optional(),
  isActive: Joi.boolean().default(true),
  isSecret: Joi.boolean().default(false),
})

const updateSchema = Joi.object({
  label: Joi.string().trim().max(200),
  isBoolean: Joi.boolean(),
  value: Joi.string().allow('', null),
  category: Joi.string().valid(...CATEGORIES),
  description: Joi.string().allow('', null),
  isActive: Joi.boolean(),
  isSecret: Joi.boolean(),
})

module.exports = {
  async getAll(req, res) {
    try {
      const { category, q, page, limit } = req.query
      const result = await service.getAll({
        category,
        q,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? Math.min(parseInt(limit, 10), 100) : 20,
      })
      res.json({ success: true, ...result })
    } catch (err) {
      logger.error(`SystemConfigController.getAll: ${err.message}`)
      res.status(500).json({ success: false, message: 'Failed to fetch configurations' })
    }
  },

  async getOne(req, res) {
    try {
      const config = await service.getOne(req.params.id)
      if (!config) return res.status(404).json({ success: false, message: 'Config not found' })
      res.json({ success: true, data: config })
    } catch (err) {
      logger.error(`SystemConfigController.getOne: ${err.message}`)
      res.status(500).json({ success: false, message: 'Failed to fetch configuration' })
    }
  },

  async create(req, res) {
    try {
      const { error, value } = createSchema.validate(req.body, { abortEarly: false, stripUnknown: true })
      if (error) {
        const errors = error.details.map(d => ({ field: d.path.join('.'), message: d.message }))
        return res.status(400).json({ success: false, message: 'Validation error', errors })
      }

      const userId = getUserId(req)
      const userAgent = req.headers['user-agent']
      const config = await service.create(value, userId, userAgent)
      res.status(201).json({ success: true, data: config })
    } catch (err) {
      logger.error(`SystemConfigController.create: ${err.message}`)
      const status = err.message.includes('already exists') ? 409 : 400
      res.status(status).json({ success: false, message: err.message })
    }
  },

  async update(req, res) {
    try {
      const { error, value } = updateSchema.validate(req.body, { abortEarly: false, stripUnknown: true })
      if (error) {
        const errors = error.details.map(d => ({ field: d.path.join('.'), message: d.message }))
        return res.status(400).json({ success: false, message: 'Validation error', errors })
      }

      const config = await service.update(req.params.id, value, getUserId(req), req.headers['user-agent'])
      if (!config) return res.status(404).json({ success: false, message: 'Config not found' })
      res.json({ success: true, data: config })
    } catch (err) {
      logger.error(`SystemConfigController.update: ${err.message}`)
      const status = err.message.includes('environment variables') ? 403 : 400
      res.status(status).json({ success: false, message: err.message })
    }
  },

  async toggleStatus(req, res) {
    try {
      const config = await service.toggleStatus(req.params.id, getUserId(req), req.headers['user-agent'])
      if (!config) return res.status(404).json({ success: false, message: 'Config not found' })
      res.json({ success: true, data: config })
    } catch (err) {
      logger.error(`SystemConfigController.toggleStatus: ${err.message}`)
      res.status(500).json({ success: false, message: 'Failed to toggle status' })
    }
  },

  async remove(req, res) {
    try {
      const result = await service.delete(req.params.id, getUserId(req), req.headers['user-agent'])
      if (!result) return res.status(404).json({ success: false, message: 'Config not found' })
      res.json({ success: true, message: 'Configuration deleted' })
    } catch (err) {
      logger.error(`SystemConfigController.remove: ${err.message}`)
      const status = err.message.includes('environment variables') ? 403 : 400
      res.status(status).json({ success: false, message: err.message })
    }
  },
}
