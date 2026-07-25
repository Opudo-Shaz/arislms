/**
 * Storage provider abstraction.
 *
 * The active provider is resolved from the "storage.provider" System Config
 * entry (admin-editable via the UI, seeded by scripts/seedSystemConfig.js)
 * and falls back to the DOCUMENT_STORAGE_PROVIDER env var when no config
 * row exists or it's inactive.
 *
 * Configure via env vars:
 *   DOCUMENT_STORAGE_PROVIDER=local|s3|minio   (default: local, fallback when storage.provider is unset)
 *   DOCUMENT_LOCAL_PATH=uploads/documents        (relative to project root, used by "local")
 *   DOCUMENT_BASE_URL=http://localhost:6505      (for building public URLs, used by "local")
 *
 *   S3-compatible providers ("s3" or "minio" — same code, any S3-compatible API):
 *   S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY   (required)
 *   S3_ENDPOINT, S3_REGION, S3_FORCE_PATH_STYLE, S3_SIGNED_URL_EXPIRY_SECONDS  (optional)
 *   See utils/storage/providers/s3Provider.js for details.
 *
 * Adding a new provider:
 *   1. Create a file here: utils/storage/providers/myProvider.js
 *   2. Export { save(file, subPath), remove(storedName), getDownloadInfo(storedName) }
 *   3. Map it in PROVIDERS below.
 */

const localProvider = require('./providers/localProvider');
const s3Provider = require('./providers/s3Provider');
const { getConfigValue } = require('../../services/systemConfigService');

const PROVIDERS = {
  local: localProvider,
  s3:    s3Provider,
  minio: s3Provider, // MinIO speaks the S3 API — same provider, point S3_ENDPOINT at your MinIO instance
};

/**
 * Resolve the currently active storage provider.
 * Checked on every call so an admin can switch providers via the System
 * Config UI without a server restart.
 * @returns {Promise<{ provider: object, providerName: string }>}
 */
async function resolveProvider() {
  const providerName = (
    await getConfigValue('storage.provider', 'string', process.env.DOCUMENT_STORAGE_PROVIDER || 'local')
  ).toLowerCase();

  const provider = PROVIDERS[providerName];

  if (!provider) {
    throw new Error(`Unknown storage provider: "${providerName}". Valid options: ${Object.keys(PROVIDERS).join(', ')}`);
  }

  return { provider, providerName };
}

module.exports = { resolveProvider };

