const SystemConfig = require('../models/systemConfigModel')
const { Op } = require('sequelize')
const logger = require('../config/logger')
const AuditLogger = require('../utils/auditLogger')

/**
 * Seed infra configs that mirror environment variables.
 * These are read-only in the UI — the env var is the authoritative source.
 *
 * Strategy: always sync the current env value so a change to .env is
 * reflected on next startup without a manual DB update.
 * Non-env-driven / UI-editable configs belong in scripts/seedSystemConfig.js.
 */
async function seedInfraConfigs() {
  const infraSeeds = [
    {
      key: 'storage.provider',
      label: 'Storage Provider',
      value: process.env.STORAGE_PROVIDER || 'local',
      category: 'storage',
      description: 'Document storage backend: local | azure | aws | minio',
    },
    {
      key: 'storage.container',
      label: 'Storage Container / Bucket',
      value: process.env.STORAGE_CONTAINER || '',
      category: 'storage',
      description: 'Blob container (Azure) or bucket name (AWS/Minio) for document uploads',
    },
    {
      key: 'email.provider.gmail.user',
      label: 'Gmail SMTP Username',
      value: process.env.EMAIL_PROVIDER_GMAIL_USER || '',
      category: 'email',
      description: 'Gmail address used to authenticate with SMTP. Controlled by EMAIL_PROVIDER_GMAIL_USER env var.',
    },
    {
      key: 'email.provider.gmail.pass',
      label: 'Gmail SMTP App Password',
      value: process.env.EMAIL_PROVIDER_GMAIL_PASS || '',
      category: 'email',
      description: 'Gmail App Password. Generate at myaccount.google.com/apppasswords. Controlled by EMAIL_PROVIDER_GMAIL_PASS env var.',
      isSecret: true,
    },
  ]

  for (const seed of infraSeeds) {
    const [row, created] = await SystemConfig.findOrCreate({
      where: { key: seed.key },
      defaults: { ...seed, isActive: true, isReadOnly: true },
    })
    if (!created && row.value !== seed.value) {
      // Env var changed since last startup — sync the new value
      await row.update({ value: seed.value })
      logger.info(`SystemConfig: synced updated env value for key=${seed.key}`)
    }
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

  /**
   * Retrieve a config value by key, cast to the requested type, with a fallback default.
   *
   * @param {string} key           - The config key (e.g. 'payment.min_overpayment_surplus')
   * @param {'string'|'number'|'boolean'|'json'} type - Target type to cast the stored text to
   * @param {*} defaultValue       - Returned when the key is missing, inactive, or unparseable
   * @returns {Promise<*>}
   */
  async getConfigValue(key, type = 'string', defaultValue = null) {
    try {
      const cfg = await SystemConfig.findOne({ where: { key } })
      if (!cfg || !cfg.isActive) return defaultValue

      // Boolean configs: the value IS isActive; the text value is irrelevant
      if (cfg.isBoolean) {
        if (type === 'boolean') return cfg.isActive
        return defaultValue
      }

      if (cfg.value == null) return defaultValue

      switch (type) {
        case 'number': {
          const n = Number(cfg.value)
          return isFinite(n) ? n : defaultValue
        }
        case 'boolean':
          return cfg.value === 'true'
        case 'json': {
          try { return JSON.parse(cfg.value) } catch { return defaultValue }
        }
        default:
          return String(cfg.value)
      }
    } catch (err) {
      logger.warn(`SystemConfig.getConfigValue('${key}'): ${err.message} — using default`)
      return defaultValue
    }
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
