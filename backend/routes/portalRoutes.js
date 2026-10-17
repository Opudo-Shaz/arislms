const express = require('express');
const multer = require('multer');
const { authenticateClient } = require('../middleware/authMiddleware');
const { validateIdParam } = require('../middleware/validateIdParam');
const { rateLimit } = require('../utils/rateLimiter');
const { MAX_FILE_BYTES, ALLOWED_MIME_TYPES } = require('../utils/fileSecurity');
const portalController = require('../controllers/portalController');

/**
 * Client self-service portal API. Uses its own principal (client session
 * tokens, `typ: 'client'`) via authenticateClient — staff tokens are rejected
 * here, and client tokens are rejected on every staff route.
 */
const router = express.Router();

// Brute-force / SMS-bombing protection for the passwordless login endpoints.
// Keyed per phone number and per challenge token (each code is also capped
// at auth.otp.max_attempts), with a looser per-IP backstop. Per-IP limits
// assume `trust proxy` is configured when running behind a load balancer.
const FIFTEEN_MIN = 15 * 60 * 1000;
const otpIpLimiter = rateLimit({ name: 'portalOtpIp', windowMs: FIFTEEN_MIN, max: 20 });
const otpRequestLimiter = rateLimit({
  name: 'portalOtpRequest',
  windowMs: FIFTEEN_MIN,
  max: 3,
  keyFn: (req) => String(req.body?.phone || '').replace(/\D/g, '').slice(-9),
});
const otpVerifyLimiter = rateLimit({
  name: 'portalOtpVerify',
  windowMs: FIFTEEN_MIN,
  max: 10,
  keyFn: (req) => String(req.body?.otpToken || '').slice(-32),
});

/**
 * @openapi
 * /api/portal/auth/request-otp:
 *   post:
 *     summary: Request a portal login code (client self-service)
 *     description: >
 *       Sends a one-time code to the client's registered phone (SMS) or saved email.
 *       The response is identical whether or not the phone is registered.
 *     tags:
 *       - Client Portal
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             phone: "0712345678"
 *             channel: sms
 *     responses:
 *       200:
 *         description: Challenge token to submit with the code
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               otpToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *               channel: sms
 *               ttlMinutes: 10
 *       429:
 *         description: Too many requests
 */
router.post('/auth/request-otp', otpIpLimiter, otpRequestLimiter, portalController.requestOtp);

/**
 * @openapi
 * /api/portal/auth/verify-otp:
 *   post:
 *     summary: Verify a portal login code and get a client session token
 *     tags:
 *       - Client Portal
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             otpToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *             code: "123456"
 *     responses:
 *       200:
 *         description: Client session issued
 *       400:
 *         description: Invalid or expired code
 *       429:
 *         description: Too many attempts
 */
router.post('/auth/verify-otp', otpIpLimiter, otpVerifyLimiter, portalController.verifyOtp);

/**
 * @openapi
 * /api/portal/public/loan-products:
 *   get:
 *     summary: Active loan products (public, for the home page and loan request form)
 *     tags:
 *       - Client Portal
 *     responses:
 *       200:
 *         description: List of active loan products
 */
router.get('/public/loan-products', portalController.getPublicLoanProducts);

// Co-signer consent pages are public (opened from an SMS/email link); the
// link token identifies the request and a one-time code to the co-signer's
// own phone/email proves who is answering.
const consentLimiter = rateLimit({ name: 'coSignerConsent', windowMs: FIFTEEN_MIN, max: 30, keyFn: (req) => req.params.token?.slice(-16) || req.ip });

/**
 * @openapi
 * /api/portal/co-signer-consents/{token}:
 *   get:
 *     summary: View a co-signer consent request (public, from the SMS/email link)
 *     tags:
 *       - Client Portal
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Loan summary, borrower name, request status and masked OTP destinations
 *       404:
 *         description: Invalid or replaced link
 */
router.get('/co-signer-consents/:token', consentLimiter, portalController.getConsent);

/**
 * @openapi
 * /api/portal/co-signer-consents/{token}/otp:
 *   post:
 *     summary: Send the co-signer a one-time code to confirm their identity
 *     tags:
 *       - Client Portal
 *     requestBody:
 *       content:
 *         application/json:
 *           example:
 *             channel: sms
 *     responses:
 *       200:
 *         description: Code sent (masked destination returned)
 *       409:
 *         description: Request no longer open
 */
router.post('/co-signer-consents/:token/otp', consentLimiter, portalController.sendConsentOtp);

/**
 * @openapi
 * /api/portal/co-signer-consents/{token}/respond:
 *   post:
 *     summary: Accept or decline co-signing (requires the one-time code)
 *     tags:
 *       - Client Portal
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             decision: accept
 *             code: "123456"
 *     responses:
 *       200:
 *         description: Decision recorded; borrower and approvers notified
 *       400:
 *         description: Invalid code
 *       409:
 *         description: Request no longer open
 */
router.post('/co-signer-consents/:token/respond', consentLimiter, portalController.respondToConsent);

// Everything below requires a client session.
router.use(authenticateClient);

/**
 * @openapi
 * /api/portal/me:
 *   get:
 *     summary: The logged-in client's profile (with latest credit score)
 *     tags:
 *       - Client Portal
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Client profile
 *   patch:
 *     summary: Update the client's own contact details
 *     description: Only email, secondaryPhone, address and preferredContactMethod can be changed.
 *     tags:
 *       - Client Portal
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             secondaryPhone: "0722000000"
 *             preferredContactMethod: sms
 *     responses:
 *       200:
 *         description: Updated profile
 */
router.get('/me', portalController.getMe);
router.patch('/me', portalController.updateMe);

/**
 * @openapi
 * /api/portal/me/dashboard:
 *   get:
 *     summary: Dashboard summary — current loan, next installment, credit score, recent payments
 *     tags:
 *       - Client Portal
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data
 */
router.get('/me/dashboard', portalController.getDashboard);

/**
 * @openapi
 * /api/portal/me/credit-score:
 *   get:
 *     summary: The client's latest credit score (0–5, grade A–E, credit limit)
 *     tags:
 *       - Client Portal
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Latest credit score, or null if never scored
 */
router.get('/me/credit-score', portalController.getMyCreditScore);

const documentUploadLimiter = rateLimit({ name: 'portalDocUpload', windowMs: 60 * 60 * 1000, max: 20, keyFn: (req) => `client:${req.client?.id}` });

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 2, parts: 4 },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
    return cb(Object.assign(new Error('Only JPG, PNG, WebP or PDF files are accepted'), { status: 400 }));
  },
}).single('file');

const handleDocumentUpload = (req, res, next) => {
  documentUpload(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `The file must be smaller than ${MAX_FILE_BYTES / (1024 * 1024)} MB`
      : err.status === 400 || err instanceof multer.MulterError
        ? err.message
        : 'The upload could not be processed';
    return res.status(400).json({ success: false, message });
  });
};

/**
 * @openapi
 * /api/portal/me/documents:
 *   get:
 *     summary: The client's KYC documents and which types they may upload now
 *     tags:
 *       - Client Portal
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "{ documents, editable, uploadableTypes }"
 *   post:
 *     summary: Upload / re-upload a KYC document
 *     description: >
 *       Only while the client is pending KYC reverification, and only for files
 *       flagged for re-upload or required types (photo, ID) not yet on file.
 *     tags:
 *       - Client Portal
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, documentType]
 *             properties:
 *               file: { type: string, format: binary }
 *               documentType: { type: string, example: national_id }
 *     responses:
 *       201:
 *         description: Document submitted for review
 *       403:
 *         description: Upload not allowed for this document / status
 */
router.get('/me/documents', portalController.listMyDocuments);
router.post('/me/documents', documentUploadLimiter, handleDocumentUpload, portalController.uploadMyDocument);

/**
 * @openapi
 * /api/portal/me/documents/{id}/download:
 *   get:
 *     summary: View one of the client's own KYC documents
 *     tags:
 *       - Client Portal
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: File binary
 *       404:
 *         description: Not found (or not the client's)
 */
router.get('/me/documents/:id/download', validateIdParam(), portalController.downloadMyDocument);

/**
 * @openapi
 * /api/portal/me/documents/{id}/change-request:
 *   post:
 *     summary: Ask staff to allow replacing a verified KYC document
 *     tags:
 *       - Client Portal
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             reason: My ID card has expired
 *     responses:
 *       200:
 *         description: Request recorded (verificationStatus = change_requested)
 *       409:
 *         description: Document is not verified
 */
router.post('/me/documents/:id/change-request', validateIdParam(), portalController.requestDocumentChange);

/**
 * @openapi
 * /api/portal/me/loans:
 *   get:
 *     summary: The client's loans (keyset paginated)
 *     tags:
 *       - Client Portal
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *       - in: query
 *         name: direction
 *         schema: { type: string, enum: [next, prev] }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Page of loans
 */
router.get('/me/loans', portalController.listMyLoans);

/**
 * @openapi
 * /api/portal/me/loans/{id}:
 *   get:
 *     summary: One of the client's loans (404 if it belongs to someone else)
 *     tags:
 *       - Client Portal
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Loan detail
 *       404:
 *         description: Loan not found
 */
router.get('/me/loans/:id', validateIdParam(), portalController.getMyLoan);
router.get('/me/loans/:id/schedules', validateIdParam(), portalController.getMyLoanSchedules);
router.get('/me/loans/:id/payments', validateIdParam(), portalController.getMyLoanPayments);

/**
 * @openapi
 * /api/portal/me/payments:
 *   get:
 *     summary: Payments recorded on the client's loans (keyset paginated)
 *     tags:
 *       - Client Portal
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Page of payments
 */
router.get('/me/payments', portalController.listMyPayments);

/**
 * @openapi
 * /api/portal/loan-requests:
 *   post:
 *     summary: Submit a loan request (credit-scored; approvers are notified)
 *     description: >
 *       Runs the standard credit-scoring pipeline. A passing score queues the
 *       loan as under_review; otherwise it is queued as pending for manual
 *       review. Either way, users with loans:approve are notified.
 *     tags:
 *       - Client Portal
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             loanProductId: 1
 *             principalAmount: 20000
 *             termMonths: 6
 *             notes: School fees
 *     responses:
 *       201:
 *         description: Request queued; `scorePassed` and `message` explain the outcome
 *       422:
 *         description: Not eligible (KYC incomplete, open loan, above credit limit, ...)
 */
router.post('/loan-requests', portalController.submitLoanRequest);

// Exact-phone co-signer lookup; rate-limited per client to stop number probing.
const coSignerLookupLimiter = rateLimit({ name: 'coSignerLookup', windowMs: FIFTEEN_MIN, max: 10, keyFn: (req) => String(req.client?.id) });

/**
 * @openapi
 * /api/portal/co-signers/lookup:
 *   post:
 *     summary: Find an eligible co-signer by their exact phone number
 *     description: >
 *       Returns a masked name and phone for confirmation plus a short-lived
 *       `coSignerToken` to submit with a loan request — never the client's id
 *       or full details. Rate limited.
 *     tags:
 *       - Client Portal
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             phone: "0712345678"
 *     responses:
 *       200:
 *         description: Match found
 *       404:
 *         description: No eligible client with that number
 */
router.post('/co-signers/lookup', coSignerLookupLimiter, portalController.lookupCoSigner);

/**
 * @openapi
 * /api/portal/me/loans/{id}/co-signer:
 *   put:
 *     summary: Nominate a (new) co-signer for an open loan request
 *     description: Used after a co-signer declines or the consent link expires. Sends a new consent request.
 *     tags:
 *       - Client Portal
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             coSignerToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Co-signer updated and consent requested
 *       409:
 *         description: Loan no longer awaiting a decision, or consent already given
 */
router.put('/me/loans/:id/co-signer', validateIdParam(), portalController.renominateCoSigner);

/**
 * @openapi
 * /api/portal/payment-reports:
 *   get:
 *     summary: Payments the client has reported (keyset paginated)
 *     tags:
 *       - Client Portal
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Page of payment reports
 *   post:
 *     summary: Report a manual repayment (e.g. M-Pesa) for staff to confirm
 *     description: Attached automatically to the client's current repayable loan.
 *     tags:
 *       - Client Portal
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             amount: 2500
 *             transactionDate: "2026-10-14T09:30:00Z"
 *             paymentMethod: MPESA
 *             externalRef: SJK3XY12AB
 *             payerPhone: "254712345678"
 *     responses:
 *       201:
 *         description: Report submitted
 *       409:
 *         description: Reference already recorded or reported
 *       422:
 *         description: No active loan to report against
 */
router.get('/payment-reports', portalController.listMyPaymentReports);
router.post('/payment-reports', portalController.submitPaymentReport);

module.exports = router;
