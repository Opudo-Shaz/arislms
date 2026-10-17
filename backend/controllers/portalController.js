const portalAuthService = require('../services/portalAuthService');
const portalService = require('../services/portalService');
const portalLoanService = require('../services/portalLoanService');
const paymentReportService = require('../services/paymentReportService');
const coSignerConsentService = require('../services/coSignerConsentService');
const portalDocumentService = require('../services/portalDocumentService');
const { sendDocumentFile } = require('./documentController');
const RepaymentScheduleResponseDto = require('../dtos/repaymentSchedule/RepaymentScheduleResponseDto');
const {
  PortalProfileDto,
  PortalCreditScoreDto,
  PortalLoanDto,
  PortalPaymentDto,
  PaymentReportDto,
  PortalLoanProductDto,
  PortalDocumentDto,
} = require('../dtos/portal/PortalResponseDto');
const schemas = require('../dtos/portal/PortalRequestDto');
const { validateSync } = require('../utils/validationMiddleware');
const { parseKeysetQuery, toPaginationDto } = require('../utils/keysetPagination');
const logger = require('../config/logger');

/**
 * Client self-service portal endpoints (/api/portal). Every authenticated
 * handler reads the client from req.client (set by authenticateClient) —
 * never from the body, query or params.
 */

const userAgentOf = (req) => req.headers['user-agent'] || 'unknown';

/** Run validation; on failure send a 400 and return null. */
function validated(req, res, schema) {
  const { valid, errors, value } = validateSync(req.body || {}, schema);
  if (!valid) {
    res.status(400).json({ success: false, message: 'Validation error', errors });
    return null;
  }
  return value;
}

/** Wrap a handler with the shared error → HTTP status mapping. */
const handle = (label, fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    if (status >= 500) {
      logger.error(`[portal] ${label} failed: ${error.message}`);
      return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
    }
    return res.status(status).json({
      success: false,
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
      ...(error.creditLimit !== undefined ? { creditLimit: error.creditLimit } : {}),
    });
  }
};

// ── Auth (public) ─────────────────────────────────────────────────────

exports.requestOtp = handle('requestOtp', async (req, res) => {
  const body = validated(req, res, schemas.requestOtpSchema);
  if (!body) return;
  const result = await portalAuthService.requestOtp(body, userAgentOf(req));
  res.json({
    success: true,
    message: 'If this number is registered, a verification code has been sent. '
      + 'Codes requested by email are sent by SMS when no valid email is on file.',
    ...result,
  });
});

exports.verifyOtp = handle('verifyOtp', async (req, res) => {
  const body = validated(req, res, schemas.verifyOtpSchema);
  if (!body) return;
  const session = await portalAuthService.verifyOtp(body, userAgentOf(req));
  res.json({ success: true, message: 'Login successful', ...session });
});

exports.getPublicLoanProducts = handle('getPublicLoanProducts', async (req, res) => {
  const products = await portalService.getPortalLoanProducts();
  res.json({ success: true, data: products.map(PortalLoanProductDto) });
});

// ── Profile / dashboard ───────────────────────────────────────────────

exports.getMe = handle('getMe', async (req, res) => {
  const client = await portalService.getProfile(req.client.id);
  res.json({ success: true, data: PortalProfileDto(client) });
});

exports.updateMe = handle('updateMe', async (req, res) => {
  const body = validated(req, res, schemas.updateProfileSchema);
  if (!body) return;
  await portalService.updateProfile(req.client.id, body, userAgentOf(req));
  const client = await portalService.getProfile(req.client.id);
  res.json({ success: true, message: 'Profile updated', data: PortalProfileDto(client) });
});

exports.getMyCreditScore = handle('getMyCreditScore', async (req, res) => {
  const score = await portalService.getLatestCreditScore(req.client.id);
  res.json({ success: true, data: PortalCreditScoreDto(score) });
});

// ── KYC documents ────────────────────────────────────────────────────────────────

exports.listMyDocuments = handle('listMyDocuments', async (req, res) => {
  const { documents, editable, uploadableTypes } = await portalDocumentService.listMine(req.client.id);
  res.json({ success: true, data: { documents: documents.map(PortalDocumentDto), editable, uploadableTypes } });
});

exports.downloadMyDocument = handle('downloadMyDocument', async (req, res) => {
  const info = await portalDocumentService.getMyDownload(req.client.id, req.params.id);
  sendDocumentFile(res, info);
});

exports.uploadMyDocument = handle('uploadMyDocument', async (req, res) => {
  const body = validated(req, res, schemas.documentUploadSchema);
  if (!body) return;
  const doc = await portalDocumentService.uploadMine(req.client.id, body.documentType, req.file, userAgentOf(req));
  res.status(201).json({
    success: true,
    message: 'Thanks — your document has been submitted for review.',
    data: PortalDocumentDto(doc),
  });
});

exports.requestDocumentChange = handle('requestDocumentChange', async (req, res) => {
  const body = validated(req, res, schemas.documentChangeRequestSchema);
  if (!body) return;
  const doc = await portalDocumentService.requestChange(req.client.id, req.params.id, body.reason, userAgentOf(req));
  res.json({
    success: true,
    message: 'Your request has been sent. We will let you know when you can upload a new document.',
    data: PortalDocumentDto(doc),
  });
});

exports.getDashboard = handle('getDashboard', async (req, res) => {
  const d = await portalService.getDashboard(req.client.id);
  res.json({
    success: true,
    data: {
      currentLoan: d.currentLoan ? PortalLoanDto(d.currentLoan) : null,
      nextInstallment: d.nextInstallment,
      creditScore: PortalCreditScoreDto(d.creditScore),
      recentPayments: d.recentPayments.map(PortalPaymentDto),
      stats: d.stats,
    },
  });
});

// ── Loans ─────────────────────────────────────────────────────────────

exports.listMyLoans = handle('listMyLoans', async (req, res) => {
  const { cursor, direction, limit } = parseKeysetQuery(req.query);
  const result = await portalService.listLoans(req.client.id, { cursor, direction, limit, status: req.query.status });
  res.json({ success: true, data: result.rows.map(PortalLoanDto), pagination: toPaginationDto(result) });
});

exports.getMyLoan = handle('getMyLoan', async (req, res) => {
  const loan = await portalService.getLoan(req.client.id, req.params.id);
  res.json({ success: true, data: PortalLoanDto(loan) });
});

exports.getMyLoanSchedules = handle('getMyLoanSchedules', async (req, res) => {
  const schedules = await portalService.getLoanSchedules(req.client.id, req.params.id);
  res.json({ success: true, data: RepaymentScheduleResponseDto.fromArray(schedules) });
});

exports.getMyLoanPayments = handle('getMyLoanPayments', async (req, res) => {
  const payments = await portalService.getLoanPayments(req.client.id, req.params.id);
  res.json({ success: true, data: payments.map(PortalPaymentDto) });
});

exports.submitLoanRequest = handle('submitLoanRequest', async (req, res) => {
  const body = validated(req, res, schemas.loanRequestSchema);
  if (!body) return;
  const result = await portalLoanService.submitLoanRequest(req.client.id, body, userAgentOf(req));
  // Re-read through the portal query so the response includes the (masked) co-signer.
  const loan = await portalService.getLoan(req.client.id, result.loan.id);
  res.status(201).json({
    success: true,
    message: result.message,
    data: {
      loan: PortalLoanDto(loan),
      scorePassed: result.scorePassed,
      riskScore: result.riskScore,
      riskGrade: result.riskGrade,
      creditLimit: result.creditLimit,
    },
  });
});

// ── Payments ──────────────────────────────────────────────────────────

exports.listMyPayments = handle('listMyPayments', async (req, res) => {
  const { cursor, direction, limit } = parseKeysetQuery(req.query);
  const result = await portalService.listPayments(req.client.id, { cursor, direction, limit });
  res.json({ success: true, data: result.rows.map(PortalPaymentDto), pagination: toPaginationDto(result) });
});

exports.listMyPaymentReports = handle('listMyPaymentReports', async (req, res) => {
  const { cursor, direction, limit } = parseKeysetQuery(req.query);
  const result = await paymentReportService.listClientReports(req.client.id, { cursor, direction, limit });
  res.json({ success: true, data: result.rows.map((r) => PaymentReportDto(r)), pagination: toPaginationDto(result) });
});

exports.submitPaymentReport = handle('submitPaymentReport', async (req, res) => {
  const body = validated(req, res, schemas.paymentReportSchema);
  if (!body) return;
  const report = await paymentReportService.submitReport(req.client.id, body, userAgentOf(req));
  res.status(201).json({
    success: true,
    message: 'Thanks — your payment has been reported and will be confirmed by our team shortly.',
    data: PaymentReportDto(report),
  });
});

// ── Co-signers ────────────────────────────────────────────────────────

exports.lookupCoSigner = handle('lookupCoSigner', async (req, res) => {
  const body = validated(req, res, schemas.coSignerLookupSchema);
  if (!body) return;
  const result = await coSignerConsentService.lookupByPhone(req.client.id, body.phone);
  res.json({ success: true, data: result });
});

exports.renominateCoSigner = handle('renominateCoSigner', async (req, res) => {
  const body = validated(req, res, schemas.renominateSchema);
  if (!body) return;
  const { sentTo } = await coSignerConsentService.renominate(req.client.id, req.params.id, body.coSignerToken, userAgentOf(req));
  const loan = await portalService.getLoan(req.client.id, req.params.id);
  res.json({
    success: true,
    message: 'Your co-signer has been sent a link to consent.',
    data: { loan: PortalLoanDto(loan), sentTo },
  });
});

// ── Co-signer consent (public, by link token) ─────────────────────────

exports.getConsent = handle('getConsent', async (req, res) => {
  const data = await coSignerConsentService.getPublicView(req.params.token);
  res.json({ success: true, data });
});

exports.sendConsentOtp = handle('sendConsentOtp', async (req, res) => {
  const body = validated(req, res, schemas.consentOtpSchema);
  if (!body) return;
  const result = await coSignerConsentService.sendResponseOtp(req.params.token, body.channel, userAgentOf(req));
  res.json({ success: true, message: 'A verification code has been sent.', data: result });
});

exports.respondToConsent = handle('respondToConsent', async (req, res) => {
  const body = validated(req, res, schemas.consentRespondSchema);
  if (!body) return;
  const result = await coSignerConsentService.respond(req.params.token, body, userAgentOf(req));
  res.json({
    success: true,
    message: result.status === 'accepted'
      ? 'Thank you — you have agreed to co-sign this loan.'
      : 'You have declined to co-sign this loan. The borrower has been informed.',
    data: result,
  });
});
