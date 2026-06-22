/**
 * Local filesystem storage provider.
 *
 * Files are written to:  <projectRoot>/<DOCUMENT_LOCAL_PATH>/<subPath>/<storedName>
 * Public URL:            <DOCUMENT_BASE_URL>/<DOCUMENT_LOCAL_PATH>/<subPath>/<storedName>
 */

const fs   = require('fs');
const path = require('path');

const BASE_DIR = path.resolve(process.cwd(), process.env.DOCUMENT_LOCAL_PATH || 'uploads/documents');

/**
 * Persist a multer file buffer / stream to disk.
 *
 * @param {import('express').Request['file']} file  - multer file object
 * @param {string} subPath - category sub-folder, e.g. "client_kyc/CL-ABC123"
 * @returns {{ storedName: string, documentLink: string, fileSize: number, mimeType: string }}
 */
async function save(file, subPath) {
  const dir = path.join(BASE_DIR, subPath);
  fs.mkdirSync(dir, { recursive: true });

  // Sanitize original filename and append a timestamp to avoid collisions
  const ext          = path.extname(file.originalname).toLowerCase();
  const baseName     = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const storedName   = `${baseName}_${Date.now()}${ext}`;
  const filePath     = path.join(dir, storedName);

  fs.writeFileSync(filePath, file.buffer);

  const relativeStored = `${subPath}/${storedName}`.replace(/\\/g, '/');

  return {
    storedName: relativeStored,
    documentLink: null, // set by the service after the DB record is created (needs the record ID)
    fileSize: file.size,
    mimeType: file.mimetype,
  };
}

/**
 * Delete a previously stored file.
 * @param {string} storedName - relative path returned by save()
 */
async function remove(storedName) {
  const filePath = path.join(BASE_DIR, storedName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Return the absolute filesystem path for a stored file.
 * Used by the download endpoint to stream the file after auth.
 * @param {string} storedName
 * @returns {string}
 */
function getAbsolutePath(storedName) {
  return path.join(BASE_DIR, storedName);
}

module.exports = { save, remove, getAbsolutePath };
