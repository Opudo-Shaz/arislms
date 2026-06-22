/**
 * Storage provider abstraction.
 *
 * Configure via env vars:
 *   DOCUMENT_STORAGE_PROVIDER=local|s3|minio   (default: local)
 *   DOCUMENT_LOCAL_PATH=uploads/documents        (relative to project root)
 *   DOCUMENT_BASE_URL=http://localhost:3002       (for building public URLs)
 *
 * Adding a new provider:
 *   1. Create a file here: utils/storage/providers/myProvider.js
 *   2. Export { save(file, subPath), delete(storedName), getUrl(storedName) }
 *   3. Map it in PROVIDERS below.
 */

const localProvider = require('./providers/localProvider');

const PROVIDERS = {
  local: localProvider,
  // s3:   require('./providers/s3Provider'),
  // minio: require('./providers/minioProvider'),
};

const providerName = (process.env.DOCUMENT_STORAGE_PROVIDER || 'local').toLowerCase();
const provider = PROVIDERS[providerName];

if (!provider) {
  throw new Error(`Unknown DOCUMENT_STORAGE_PROVIDER: "${providerName}". Valid options: ${Object.keys(PROVIDERS).join(', ')}`);
}

module.exports = { provider, providerName };
