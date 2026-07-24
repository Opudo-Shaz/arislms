const SystemConfig = require('../models/systemConfigModel')
const { Op } = require('sequelize')
const logger = require('../config/logger')
const AuditLogger = require('../utils/auditLogger')
const { encrypt, decrypt, isEncrypted } = require('../utils/configEncryption')

/**
 * Return a safe plain object for API responses.
 * Secret configs have their value replaced with '[REDACTED]'.
 */
function _safeDTO(cfg) {
  const obj = cfg && typeof cfg.toJSON === 'function' ? cfg.toJSON() : { ...cfg }
  if (obj.isSecret) obj.value = '[**redacted**]'
  return obj
}

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
    const storedValue = seed.isSecret && seed.value ? encrypt(seed.value) : seed.value
    const [row, created] = await SystemConfig.findOrCreate({
      where: { key: seed.key },
      defaults: { ...seed, value: storedValue, isActive: true, isReadOnly: true },
    })
    if (!created) {
      // Decrypt stored value for drift comparison so we don't re-encrypt on every boot
      const currentPlain = row.isSecret && isEncrypted(row.value) ? decrypt(row.value) : row.value
      if (currentPlain !== seed.value) {
        const newStoredValue = seed.isSecret && seed.value ? encrypt(seed.value) : seed.value
        await row.update({ value: newStoredValue })
        logger.info(`SystemConfig: synced updated env value for key=${seed.key}`)
      }
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
    return { total: count, page, limit, data: rows.map(_safeDTO) }
  },

  async getOne(id) {
    const cfg = await SystemConfig.findByPk(id)
    return cfg ? _safeDTO(cfg) : null
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

      // Decrypt transparently — no-op on plain-text legacy values
      const rawValue = cfg.isSecret ? decrypt(cfg.value) : cfg.value
      if (rawValue == null) return defaultValue

      switch (type) {
        case 'number': {
          const n = Number(rawValue)
          return isFinite(n) ? n : defaultValue
        }
        case 'boolean':
          return rawValue === 'true'
        case 'json': {
          try { return JSON.parse(rawValue) } catch { return defaultValue }
        }
        default:
          return String(rawValue)
      }
    } catch (err) {
      logger.warn(`SystemConfig.getConfigValue('${key}'): ${err.message} — using default`)
      return defaultValue
    }
  },

  async create(data, creatorId, userAgent = 'unknown') {
    const existing = await SystemConfig.findOne({ where: { key: data.key } })
    if (existing) throw new Error(`Config key '${data.key}' already exists`)

    const payload = { ...data, createdBy: creatorId, isReadOnly: false }
    if (payload.isSecret && payload.value) {
      payload.value = encrypt(payload.value)
    }

    const config = await SystemConfig.create(payload)

    await AuditLogger.log({
      entityType: 'SYSTEM_CONFIG',
      entityId: config.id,
      action: 'CREATE',
      data: { key: config.key, label: config.label, category: config.category },
      actorId: creatorId || 1,
      options: { actorType: 'USER', source: userAgent },
    })

    logger.info(`SystemConfig created: key=${config.key} by user ${creatorId}`)
    return _safeDTO(config)
  },

  async update(id, data, actorId, userAgent = 'unknown') {
    const config = await SystemConfig.findByPk(id)
    if (!config) return null
    if (config.isReadOnly) throw new Error('This config is managed by environment variables and cannot be edited here')

    // Determine effective isSecret — caller may be promoting the row to secret on this update
    const effectiveIsSecret = data.isSecret != null ? data.isSecret : config.isSecret

    const payload = { ...data }
    if (effectiveIsSecret && payload.value != null && payload.value !== '') {
      payload.value = encrypt(payload.value)
    }

    const before = {
      value: config.isSecret ? '[REDACTED]' : config.value,
      label: config.label,
      isActive: config.isActive,
    }
    await config.update(payload)

    await AuditLogger.log({
      entityType: 'SYSTEM_CONFIG',
      entityId: id,
      action: 'UPDATE',
      data: {
        key: config.key,
        before,
        after: { ...payload, value: effectiveIsSecret ? '[REDACTED]' : payload.value },
      },
      actorId: actorId || 1,
      options: { actorType: 'USER', source: userAgent },
    })

    logger.info(`SystemConfig updated: key=${config.key} by user ${actorId}`)
    return _safeDTO(config)
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

    const snapshot = { key: config.key, label: config.label, category: config.category, value: config.isSecret ? '[REDACTED]' : config.value }
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

  async reveal(id, actorId, userAgent = 'unknown') {
    const config = await SystemConfig.findByPk(id)
    if (!config) {
      const err = new Error('Config not found')
      err.status = 404
      throw err
    }
    if (!config.isSecret) {
      const err = new Error('This config is not a secret')
      err.status = 400
      throw err
    }

    const plainValue = decrypt(config.value)

    await AuditLogger.log({
      entityType: 'SYSTEM_CONFIG',
      entityId: id,
      action: 'REVEAL',
      data: { key: config.key },
      actorId: actorId || 1,
      options: { actorType: 'USER', source: userAgent },
    })

    logger.info(`SystemConfig revealed: key=${config.key} by user ${actorId}`)
    return plainValue
  },
}
