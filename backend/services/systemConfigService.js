const SystemConfig = require('../models/systemConfigModel')
const SystemConfigCodeRelation = require('../models/systemConfigCodeRelationModel')
const Code = require('../models/codeModel')
const CodeValue = require('../models/codeValueModel')
const { Op } = require('sequelize')
const logger = require('../config/logger')
const AuditLogger = require('../utils/auditLogger')
const { encrypt, decrypt, isEncrypted } = require('../utils/configEncryption')

// Eager-load spec reused by getAll/getOne/create/update so callers always see
// the linked code (id/key/name) for dropdown-backed configs.
const CODE_RELATION_INCLUDE = {
  model: SystemConfigCodeRelation,
  as: 'codeRelation',
  include: [{ model: Code, as: 'code', attributes: ['id', 'key', 'name'] }],
}

/**
 * Return a safe plain object for API responses.
 * Secret configs have their value replaced with '[REDACTED]'.
 * Flattens the eager-loaded `codeRelation` (if present) into `codeId` + `code`.
 */
function _safeDTO(cfg) {
  const obj = cfg && typeof cfg.toJSON === 'function' ? cfg.toJSON() : { ...cfg }
  if (obj.isSecret) obj.value = '[**redacted**]'
  obj.codeId = obj.codeRelation?.codeId ?? null
  obj.code = obj.codeRelation?.code ?? null
  delete obj.codeRelation
  return obj
}

/**
 * Validate that `value` is one of the active values registered under code `codeId`.
 * Throws a descriptive error if not.
 */
async function _assertValidDropdownValue(codeId, value) {
  const code = await Code.findByPk(codeId)
  if (!code) throw new Error('Selected code was not found')

  const match = await CodeValue.findOne({ where: { codeId, value, isActive: true } })
  if (!match) throw new Error(`Value '${value}' is not a valid option for code '${code.key}'`)
}

/**
 * Create or update the system_config_code_relations row for a config, or
 * remove it when the config is no longer dropdown-backed.
 */
async function _syncCodeRelation(systemConfigId, { isDropdown, codeId }) {
  if (isDropdown && codeId) {
    const [relation] = await SystemConfigCodeRelation.findOrCreate({
      where: { systemConfigId },
      defaults: { systemConfigId, codeId },
    })
    if (relation.codeId !== codeId) await relation.update({ codeId })
  } else {
    await SystemConfigCodeRelation.destroy({ where: { systemConfigId } })
  }
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
      include: [CODE_RELATION_INCLUDE],
      order: [['category', 'ASC'], ['label', 'ASC']],
      limit,
      offset,
    })
    return { total: count, page, limit, data: rows.map(_safeDTO) }
  },

  async getOne(id) {
    const cfg = await SystemConfig.findByPk(id, { include: [CODE_RELATION_INCLUDE] })
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

    const { codeId, ...configData } = data
    const isDropdown = Boolean(configData.isDropdown)

    if (isDropdown) {
      if (!codeId) throw new Error('Code is required when Is Dropdown is enabled')
      if (configData.value) await _assertValidDropdownValue(codeId, configData.value)
    }

    const payload = { ...configData, isDropdown, createdBy: creatorId, isReadOnly: false }
    if (payload.isSecret && payload.value) {
      payload.value = encrypt(payload.value)
    }

    const config = await SystemConfig.create(payload)
    await _syncCodeRelation(config.id, { isDropdown, codeId })

    await AuditLogger.log({
      entityType: 'SYSTEM_CONFIG',
      entityId: config.id,
      action: 'CREATE',
      data: { key: config.key, label: config.label, category: config.category },
      actorId: creatorId || 1,
      options: { actorType: 'USER', source: userAgent },
    })

    logger.info(`SystemConfig created: key=${config.key} by user ${creatorId}`)
    const fresh = await SystemConfig.findByPk(config.id, { include: [CODE_RELATION_INCLUDE] })
    return _safeDTO(fresh)
  },

  async update(id, data, actorId, userAgent = 'unknown') {
    const config = await SystemConfig.findByPk(id)
    if (!config) return null
    if (config.isReadOnly) throw new Error('This config is managed by environment variables and cannot be edited here')

    const { codeId, ...configData } = data
    const effectiveIsDropdown = configData.isDropdown != null ? configData.isDropdown : config.isDropdown

    let targetCodeId = null
    if (effectiveIsDropdown) {
      if (codeId !== undefined) {
        targetCodeId = codeId
      } else {
        const existingRelation = await SystemConfigCodeRelation.findOne({ where: { systemConfigId: id } })
        targetCodeId = existingRelation?.codeId ?? null
      }
      if (!targetCodeId) throw new Error('Code is required when Is Dropdown is enabled')

      const effectiveValue = configData.value !== undefined ? configData.value : config.value
      if (effectiveValue) await _assertValidDropdownValue(targetCodeId, effectiveValue)
    }

    // Determine effective isSecret — caller may be promoting the row to secret on this update
    const effectiveIsSecret = configData.isSecret != null ? configData.isSecret : config.isSecret

    const payload = { ...configData }
    if (effectiveIsSecret && payload.value != null && payload.value !== '') {
      payload.value = encrypt(payload.value)
    }

    const before = {
      value: config.isSecret ? '[REDACTED]' : config.value,
      label: config.label,
      isActive: config.isActive,
    }
    await config.update(payload)
    await _syncCodeRelation(id, { isDropdown: effectiveIsDropdown, codeId: targetCodeId })

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
    const fresh = await SystemConfig.findByPk(id, { include: [CODE_RELATION_INCLUDE] })
    return _safeDTO(fresh)
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
    await SystemConfigCodeRelation.destroy({ where: { systemConfigId: id } })
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
