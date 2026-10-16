const express = require('express');
const multer = require('multer');
const controller = require('../controllers/publicClientRegistrationController');
const { rateLimit } = require('../utils/rateLimiter');
const { KYC_DOCUMENT_TYPES } = require('../services/clientSelfRegistrationService');
const { MAX_FILE_BYTES, ALLOWED_MIME_TYPES } = require('../utils/fileSecurity');

/**
 * Unauthenticated endpoints behind an invite-only registration link. The link
 * token in the path is the only credential, so every route re-validates it and
 * is rate limited. Per-IP limits assume `trust proxy` is configured when
 * running behind a load balancer (TRUST_PROXY).
 */
const router = express.Router();

const FIFTEEN_MIN = 15 * 60 * 1000;
const phoneKey = (req) => String(req.body?.phone || '').replace(/\D/g, '').slice(-9) || req.ip;

const readLimiter = rateLimit({ name: 'clientRegResolve', windowMs: FIFTEEN_MIN, max: 60 });
const otpIpLimiter = rateLimit({ name: 'clientRegOtpIp', windowMs: FIFTEEN_MIN, max: 20 });
const otpRequestLimiter = rateLimit({ name: 'clientRegOtpRequest', windowMs: FIFTEEN_MIN, max: 3, keyFn: phoneKey });
const otpVerifyLimiter = rateLimit({ name: 'clientRegOtpVerify', windowMs: FIFTEEN_MIN, max: 10, keyFn: phoneKey });
const submitLimiter = rateLimit({ name: 'clientRegSubmit', windowMs: 60 * 60 * 1000, max: 30 });

const FILE_FIELDS = KYC_DOCUMENT_TYPES;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: FILE_FIELDS.length, fields: 2, fieldSize: 100 * 1024, parts: 10 },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
    return cb(Object.assign(new Error('Only JPG, PNG, WebP or PDF files are accepted'), { status: 400 }));
  },
}).fields(FILE_FIELDS.map((name) => ({ name, maxCount: 1 })));

// Turn multer failures (size, count, type) into the same 400 shape as validation errors.
const handleUpload = (req, res, next) => {
  upload(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `Each file must be smaller than ${MAX_FILE_BYTES / (1024 * 1024)} MB`
      : err.status === 400 || err instanceof multer.MulterError
        ? err.message
        : 'The upload could not be processed';
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: [{ field: err.field ? `files.${err.field}` : 'files', message }],
    });
  });
};

/**
 * @openapi
 * /api/public/client-registration/{token}:
 *   get:
 *     summary: Check that a registration link is valid
 *     tags: [Client Registration (Public)]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Link is usable
 *       403:
 *         description: Link revoked
 *       404:
 *         description: Unknown link
 *       410:
 *         description: Link expired
 */
router.get('/:token', readLimiter, controller.resolveLink);

router.post('/:token/otp/request', otpIpLimiter, otpRequestLimiter, controller.requestOtp);
router.post('/:token/otp/verify', otpIpLimiter, otpVerifyLimiter, controller.verifyOtp);

/**
 * @openapi
 * /api/public/client-registration/{token}/submit:
 *   post:
 *     summary: Submit a client registration with KYC documents
 *     tags: [Client Registration (Public)]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object]
 *             properties:
 *               payload:          { type: string, description: JSON-encoded form fields }
 *               client_photo:     { type: string, format: binary, description: Required }
 *               national_id:      { type: string, format: binary, description: "Document matching idDocumentType (national_id, passport, driving_license; other for alien_id) is required" }
 *               passport:         { type: string, format: binary }
 *               driving_license:  { type: string, format: binary }
 *               birth_certificate: { type: string, format: binary }
 *               other:            { type: string, format: binary }
 *               proofOfIncome:  { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Submitted; client is pending KYC verification
 */
router.post('/:token/submit', submitLimiter, handleUpload, controller.submit);

module.exports = router;
