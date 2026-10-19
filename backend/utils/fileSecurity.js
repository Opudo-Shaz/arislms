/**
 * Upload hardening for public (unauthenticated) submissions. Everything is
 * checked against the file's actual bytes, never the client-supplied MIME or
 * extension. This is structural validation, not antivirus: content that can't
 * be seen without decompressing PDF streams is not inspected.
 */

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const TYPES = {
  'image/jpeg': { exts: ['.jpg', '.jpeg'] },
  'image/png': { exts: ['.png'] },
  'image/webp': { exts: ['.webp'] },
  'application/pdf': { exts: ['.pdf'] },
};

// Any of these as an inner extension ("invoice.php.jpg") is a classic upload-filter bypass.
const DANGEROUS_EXT_SEGMENTS = new Set([
  'php', 'phtml', 'phar', 'asp', 'aspx', 'jsp', 'cgi', 'pl', 'py', 'rb', 'sh', 'bash', 'bat', 'cmd',
  'com', 'exe', 'dll', 'msi', 'scr', 'js', 'mjs', 'vbs', 'ps1', 'jar', 'html', 'htm', 'svg', 'xml', 'hta',
]);

const PDF_ACTIVE_CONTENT = [
  /\/JavaScript\b/i,
  /\/JS\b/,
  /\/Launch\b/,
  /\/EmbeddedFile/,
  /\/OpenAction\b/,
  /\/AA\b/,
  /\/RichMedia\b/,
  /\/XFA\b/,
  /\/SubmitForm\b/,
  /\/ImportData\b/,
  // "/J#61vaScript"-style hex-escaped names are only ever used to dodge scanners.
  /\/[A-Za-z]{2,}#[0-9A-Fa-f]{2}/,
];

const SCRIPT_MARKERS = [/<\?php/i, /<script/i, /#!\/(?:bin|usr)\//];

function detectType(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  if (buf.length >= 5 && buf.toString('latin1', 0, 5) === '%PDF-') return 'application/pdf';
  return null;
}

// Walks the JPEG's marker structure and reports whether the primary image reaches its EOI marker.
// Camera JPEGs legitimately carry data after EOI (MPF/Ultra HDR gain maps, motion-photo videos,
// vendor trailers), so bytes beyond it are tolerated; the script-marker scan still covers them.
function jpegIsComplete(buf) {
  let i = 2;
  while (i + 1 < buf.length) {
    if (buf[i] !== 0xff) return false;
    const marker = buf[i + 1];
    if (marker === 0xff) { i += 1; continue; }
    if (marker === 0xd9) return true;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { i += 2; continue; }
    if (i + 3 >= buf.length) return false;
    const segLen = buf.readUInt16BE(i + 2);
    if (segLen < 2) return false;
    i += 2 + segLen;
    if (marker === 0xda) {
      // Entropy-coded data: 0xFF is always stuffed (FF00) or a restart marker until the next real marker.
      while (i + 1 < buf.length && !(buf[i] === 0xff && buf[i + 1] !== 0x00 && !(buf[i + 1] >= 0xd0 && buf[i + 1] <= 0xd7))) {
        i += 1;
      }
    }
  }
  return false;
}

// Trailing bytes after the format's own terminator are how payloads get smuggled into valid images.
function hasTrailingData(type, buf) {
  if (type === 'image/jpeg') return !jpegIsComplete(buf);
  if (type === 'image/png') {
    const iend = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
    return !(buf.length >= 8 && buf.subarray(buf.length - 8).equals(iend));
  }
  if (type === 'image/webp') {
    const declared = buf.readUInt32LE(4) + 8;
    return declared !== buf.length && declared + 1 !== buf.length;
  }
  if (type === 'application/pdf') {
    return !buf.toString('latin1', Math.max(0, buf.length - 1024)).includes('%%EOF');
  }
  return false;
}

function sanitizeName(name, ext) {
  const base = String(name || 'document')
    .replace(/^.*[\\/]/, '')
    .replace(/\.[^.]*$/, '')
    .replace(/[^A-Za-z0-9 _-]/g, '')
    .trim()
    .slice(0, 80);
  return `${base || 'document'}${ext}`;
}

/**
 * @param {{buffer: Buffer, size: number, originalname: string, mimetype: string}} file multer memory file
 * @returns {{ok: true, mimeType: string, safeName: string} | {ok: false, error: string}}
 */
function validateUpload(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    return { ok: false, error: 'The file is empty' };
  }
  const { buffer } = file;
  if (buffer.length > MAX_FILE_BYTES) {
    return { ok: false, error: `File is larger than ${MAX_FILE_BYTES / (1024 * 1024)} MB` };
  }

  const original = String(file.originalname || '');
  const segments = original.split('.').slice(1).map((s) => s.toLowerCase());
  if (segments.some((s) => DANGEROUS_EXT_SEGMENTS.has(s))) {
    return { ok: false, error: 'This file name is not allowed' };
  }
  const ext = segments.length ? `.${segments[segments.length - 1]}` : '';

  const detected = detectType(buffer);
  if (!detected) return { ok: false, error: 'Only JPG, PNG, WebP or PDF files are accepted' };

  if (!TYPES[detected].exts.includes(ext)) {
    return { ok: false, error: 'The file extension does not match its content' };
  }
  if (file.mimetype !== detected) {
    return { ok: false, error: 'The declared file type does not match its content' };
  }
  if (hasTrailingData(detected, buffer)) {
    return { ok: false, error: 'The file appears to be corrupted or contains hidden data' };
  }

  const text = buffer.toString('latin1');
  if (SCRIPT_MARKERS.some((re) => re.test(text))) {
    return { ok: false, error: 'The file contains disallowed content' };
  }
  if (detected === 'application/pdf') {
    // Stream bodies are compressed binary; scanning them only yields chance matches.
    const structure = text.replace(/stream\r?\n[\s\S]*?endstream/g, 'stream endstream');
    if (PDF_ACTIVE_CONTENT.some((re) => re.test(structure))) {
      return { ok: false, error: 'PDFs containing scripts or embedded files are not accepted' };
    }
  }

  return { ok: true, mimeType: detected, safeName: sanitizeName(original, TYPES[detected].exts[0]) };
}

module.exports = { validateUpload, MAX_FILE_BYTES, ALLOWED_MIME_TYPES: Object.keys(TYPES) };
