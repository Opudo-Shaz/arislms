/**
 * S3-compatible object storage provider.
 *
 * Works with any S3-compatible API: AWS S3, Cloudflare R2, Backblaze B2,
 * MinIO, Wasabi, etc. Point the endpoint at the provider's endpoint (leave
 * unset for real AWS S3).
 *
 * Settings are read from the System Config table (category "storage",
 * seeded by scripts/seedSystemConfig.js so they're admin-editable via the
 * UI) and fall back to the matching env var when no config row exists:
 *
 *   storage.s3.bucket                -> S3_BUCKET             (required)
 *   storage.s3.access_key_id         -> S3_ACCESS_KEY_ID       (required)
 *   storage.s3.secret_access_key     -> S3_SECRET_ACCESS_KEY   (required)
 *   storage.s3.endpoint              -> S3_ENDPOINT            (e.g. R2: https://<accountid>.r2.cloudflarestorage.com)
 *   storage.s3.region                -> S3_REGION              (default: "auto")
 *   storage.s3.force_path_style      -> S3_FORCE_PATH_STYLE    (default: "true", needed for R2/MinIO)
 *   storage.s3.signed_url_expiry_seconds -> S3_SIGNED_URL_EXPIRY_SECONDS (default: 300)
 *
 * Objects are stored under key: <subPath>/<storedName>
 */

const path = require('path');
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getConfigValue } = require('../../../services/systemConfigService');

/**
 * Resolve the current S3 settings: System Config first, env var as fallback.
 */
async function getConfig() {
  const [bucket, accessKeyId, secretAccessKey, endpoint, region, forcePathStyle, signedUrlExpirySeconds] = await Promise.all([
    getConfigValue('storage.s3.bucket', 'string', process.env.S3_BUCKET || ''),
    getConfigValue('storage.s3.access_key_id', 'string', process.env.S3_ACCESS_KEY_ID || ''),
    getConfigValue('storage.s3.secret_access_key', 'string', process.env.S3_SECRET_ACCESS_KEY || ''),
    getConfigValue('storage.s3.endpoint', 'string', process.env.S3_ENDPOINT || ''),
    getConfigValue('storage.s3.region', 'string', process.env.S3_REGION || 'auto'),
    getConfigValue('storage.s3.force_path_style', 'boolean', (process.env.S3_FORCE_PATH_STYLE || 'true').toLowerCase() === 'true'),
    getConfigValue('storage.s3.signed_url_expiry_seconds', 'number', parseInt(process.env.S3_SIGNED_URL_EXPIRY_SECONDS || '300', 10)),
  ]);

  return { bucket, accessKeyId, secretAccessKey, endpoint, region, forcePathStyle, signedUrlExpirySeconds };
}

/**
 * Build a fresh S3 client from the resolved config. Cheap to construct
 * (no network calls), so it's rebuilt on every operation to pick up
 * config/credential changes made via the UI without a server restart.
 */
function buildClient(config) {
  if (!config.bucket) {
    throw new Error('storage.s3.bucket (or S3_BUCKET env var) is required when DOCUMENT_STORAGE_PROVIDER=s3 (or minio)');
  }

  return new S3Client({
    region: config.region,
    endpoint: config.endpoint || undefined,
    forcePathStyle: config.forcePathStyle,
    credentials: config.accessKeyId
      ? {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        }
      : undefined, // fall back to default AWS credential chain (e.g. IAM role)
  });
}

/**
 * Persist a multer file buffer to the bucket.
 *
 * @param {import('express').Request['file']} file  - multer file object
 * @param {string} subPath - category sub-folder, e.g. "client_kyc/CL-ABC123"
 * @returns {{ storedName: string, documentLink: string, fileSize: number, mimeType: string }}
 */
async function save(file, subPath) {
  const config = await getConfig();
  const client = buildClient(config);

  // Sanitize original filename and append a timestamp to avoid collisions
  const ext        = path.extname(file.originalname).toLowerCase();
  const baseName    = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const storedName  = `${baseName}_${Date.now()}${ext}`;
  const key          = `${subPath}/${storedName}`.replace(/\\/g, '/');

  await client.send(new PutObjectCommand({
    Bucket:      config.bucket,
    Key:         key,
    Body:        file.buffer,
    ContentType: file.mimetype,
  }));

  return {
    storedName: key,
    documentLink: null, // set by the service after the DB record is created (needs the record ID)
    fileSize: file.size,
    mimeType: file.mimetype,
  };
}

/**
 * Delete a previously stored object.
 * @param {string} storedName - object key returned by save()
 */
async function remove(storedName) {
  const config = await getConfig();
  const client = buildClient(config);
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: storedName }));
}

/**
 * Return info needed to serve a stored object to the client.
 * Used by the download endpoint after auth. The object bytes are fetched
 * server-side and streamed through the API — the browser never talks to
 * the bucket directly, so no CORS configuration is needed on the bucket
 * and no signed URL is ever exposed to the client.
 * @param {string} storedName
 * @returns {{ type: 'stream', body: import('stream').Readable, contentType: string|undefined, contentLength: number|undefined, etag: string|undefined }}
 */
async function getDownloadInfo(storedName) {
  const config = await getConfig();
  const client = buildClient(config);
  const object = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: storedName }));
  return {
    type: 'stream',
    body: object.Body,
    contentType: object.ContentType,
    contentLength: object.ContentLength,
    etag: object.ETag,
  };
}

/**
 * Generate a short-lived presigned URL for direct access to a stored object.
 * NOT used by the current download flow (which streams bytes through the API
 * instead — see getDownloadInfo above). Kept as a reserved helper for a
 * possible future "external share link" feature. Requires the bucket/CORS
 * to allow direct browser access if ever wired up to a route.
 * @param {string} storedName
 * @returns {Promise<string>}
 */
async function getSignedDownloadUrl(storedName) {
  const config = await getConfig();
  const client = buildClient(config);
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: config.bucket, Key: storedName }),
    { expiresIn: config.signedUrlExpirySeconds },
  );
}

module.exports = { save, remove, getDownloadInfo, getSignedDownloadUrl };
