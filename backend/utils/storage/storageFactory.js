/**
 * Storage provider abstraction.
 *
 * Configure via env vars:
 *   DOCUMENT_STORAGE_PROVIDER=local|s3|minio   (default: local)
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

const PROVIDERS = {
  local: localProvider,
  s3:    s3Provider,
  minio: s3Provider, // MinIO speaks the S3 API — same provider, point S3_ENDPOINT at your MinIO instance
};

const providerName = (process.env.DOCUMENT_STORAGE_PROVIDER || 'local').toLowerCase();
const provider = PROVIDERS[providerName];

if (!provider) {
  throw new Error(`Unknown DOCUMENT_STORAGE_PROVIDER: "${providerName}". Valid options: ${Object.keys(PROVIDERS).join(', ')}`);
}

module.exports = { provider, providerName };
