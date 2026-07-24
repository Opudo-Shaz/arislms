const crypto = require('crypto')

/**
 * AES-256-GCM encryption helpers for SystemConfig secret values.
 *
 * Encrypted values are stored as:
 *   enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 *
 * The "enc:v1:" prefix lets the service detect encrypted values and safely
 * skip unencrypted legacy rows (e.g. empty strings seeded before this feature).
 *
 * Key source: process.env.CONFIG_ENCRYPTION_KEY — exactly 64 hex characters
 * (32 bytes, AES-256).
 *
 * Generate a key:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

const PREFIX = 'enc:v1:'
const ALGO = 'aes-256-gcm'
const IV_LEN = 12   // 96-bit IV — recommended for GCM
const TAG_LEN = 16  // 128-bit auth tag (GCM default)

function _getKey() {
  const hex = process.env.CONFIG_ENCRYPTION_KEY
  if (!hex || hex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'CONFIG_ENCRYPTION_KEY is not set or invalid. ' +
      'It must be exactly 64 hex characters (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypt a plaintext string.
 * Returns the value unchanged if it is null, undefined, or an empty string.
 * @param {string} plaintext
 * @returns {string}
 */
function encrypt(plaintext) {
  if (plaintext == null || plaintext === '') return plaintext

  const key = _getKey()
  const iv  = crypto.randomBytes(IV_LEN)

  const cipher = crypto.createCipheriv(ALGO, key, iv, { authTagLength: TAG_LEN })
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypt a value produced by encrypt().
 * Returns the value unchanged if it does not start with the enc:v1: prefix
 * (safe fallback for plain-text legacy rows and empty values).
 * @param {string} stored
 * @returns {string}
 */
function decrypt(stored) {
  if (!isEncrypted(stored)) return stored

  const key  = _getKey()
  const rest = stored.slice(PREFIX.length)   // "<iv_hex>:<tag_hex>:<cipher_hex>"
  const parts = rest.split(':')
  if (parts.length !== 3) throw new Error('configEncryption: malformed encrypted value')

  const [ivHex, tagHex, cipherHex] = parts
  const iv         = Buffer.from(ivHex,     'hex')
  const tag        = Buffer.from(tagHex,    'hex')
  const ciphertext = Buffer.from(cipherHex, 'hex')

  const decipher = crypto.createDecipheriv(ALGO, key, iv, { authTagLength: TAG_LEN })
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

/**
 * Returns true if the value was produced by encrypt() and needs decryption.
 * @param {string|null|undefined} value
 * @returns {boolean}
 */
function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

module.exports = { encrypt, decrypt, isEncrypted }
