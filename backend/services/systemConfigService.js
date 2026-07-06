const SystemConfig = require('../models/systemConfigModel')
const { Op } = require('sequelize')
const logger = require('../config/logger')
const AuditLogger = require('../utils/auditLogger')

/**
 * Seed infra configs that mirror environment variables.
 * Existing rows are NOT overwritten (upsert only sets value if row is new).
 */
async function seedInfraConfigs() {
  const infraSeeds = [
    {
      key: 'storage.provider',
      label: 'Storage Provider',
      value: process.env.STORAGE_PROVIDER || 'local',
      category: 'storage',
      description: 'Document storage backend: local | azure | aws | minio',
      isReadOnly: true,
    },
    {
      key: 'storage.container',
      label: 'Storage Container / Bucket',
      value: process.env.STORAGE_CONTAINER || '',
      category: 'storage',
      description: 'Blob container (Azure) or bucket name (AWS/Minio) for document uploads',
      isReadOnly: true,
    },
  ]

  for (const seed of infraSeeds) {
    await SystemConfig.findOrCreate({
      where: { key: seed.key },
      defaults: { ...seed, isActive: true },
    })
  }

  logger.info('SystemConfig: infra seeds applied')
}

module.exports = {
  seedInfraConfigs,

  async getAll({ category, q, page = 1, limit = 20 } = {}) {
    const where = {}
    if (category) where.category = category
    if (q) {
      const like = { [Op.iLike]: `%${q}%` }
      where[Op.or] = [{ key: like }, { label: like }, { value: like }, { description: like }]
    }
    const offset = (page - 1) * limit
    const { count, rows } = await SystemConfig.findAndCountAll({
      where,
      order: [['category', 'ASC'], ['label', 'ASC']],
      limit,
      offset,
    })
    return { total: count, page, limit, data: rows }
  },

  async getOne(id) {
    return SystemConfig.findByPk(id)
  },

  async getByKey(key) {
    return SystemConfig.findOne({ where: { key } })
  },

  async create(data, creatorId, userAgent = 'unknown') {
    const existing = await SystemConfig.findOne({ where: { key: data.key } })
    if (existing) throw new Error(`Config key '${data.key}' already exists`)

    const config = await SystemConfig.create({ ...data, createdBy: creatorId, isReadOnly: false })

    await AuditLogger.log({
      entityType: 'SYSTEM_CONFIG',
      entityId: config.id,
      action: 'CREATE',
      data: { key: config.key, label: config.label, category: config.category },
      actorId: creatorId || 1,
      options: { actorType: 'USER', source: userAgent },
    })

    logger.info(`SystemConfig created: key=${config.key} by user ${creatorId}`)
    return config
  },

  async update(id, data, actorId, userAgent = 'unknown') {
    const config = await SystemConfig.findByPk(id)
    if (!config) return null
    if (config.isReadOnly) throw new Error('This config is managed by environment variables and cannot be edited here')

    const before = { value: config.value, label: config.label, isActive: config.isActive }
    await config.update(data)

    await AuditLogger.log({
      entityType: 'SYSTEM_CONFIG',
      entityId: id,
      action: 'UPDATE',
      data: { key: config.key, before, after: data },
      actorId: actorId || 1,
      options: { actorType: 'USER', source: userAgent },
    })

    logger.info(`SystemConfig updated: key=${config.key} by user ${actorId}`)
    return config
  },

  async toggleStatus(id, actorId, userAgent = 'unknown') {
    const config = await SystemConfig.findByPk(id)
    if (!config) return null
    const prev = config.isActive
    await config.update({ isActive: !prev })

    await AuditLogger.log({
      entityType: 'SYSTEM_CONFIG',
      entityId: id,
      action: 'UPDATE',
      data: { key: config.key, before: { isActive: prev }, after: { isActive: !prev } },
      actorId: actorId || 1,
      options: { actorType: 'USER', source: userAgent },
    })

    logger.info(`SystemConfig toggled: key=${config.key} isActive=${!prev} by user ${actorId}`)
    return config
  },

  async delete(id, actorId, userAgent = 'unknown') {
    const config = await SystemConfig.findByPk(id)
    if (!config) return null
    if (config.isReadOnly) throw new Error('This config is managed by environment variables and cannot be deleted')

    const snapshot = { key: config.key, label: config.label, category: config.category, value: config.value }
    await config.destroy()

    await AuditLogger.log({
      entityType: 'SYSTEM_CONFIG',
      entityId: id,
      action: 'DELETE',
      data: snapshot,
      actorId: actorId || 1,
      options: { actorType: 'USER', source: userAgent },
    })

    logger.warn(`SystemConfig deleted: key=${snapshot.key} by user ${actorId}`)
    return true
  },
}
