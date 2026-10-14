const paymentReportService = require('../services/paymentReportService');
const { PaymentReportDto } = require('../dtos/portal/PortalResponseDto');
const schemas = require('../dtos/portal/PortalRequestDto');
const PaymentReportStatus = require('../enums/paymentReportStatus');
const { validateSync } = require('../utils/validationMiddleware');
const { parseKeysetQuery, toPaginationDto } = require('../utils/keysetPagination');
const logger = require('../config/logger');

/** Staff review of client-reported payments (/api/payment-reports). */

const toDto = (r) => PaymentReportDto(r, { forStaff: true });
const userAgentOf = (req) => req.headers['user-agent'] || 'unknown';

function validated(req, res, schema) {
  const { valid, errors, value } = validateSync(req.body || {}, schema);
  if (!valid) {
    res.status(400).json({ success: false, message: 'Validation error', errors });
    return null;
  }
  return value;
}

const handle = (label, fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    if (status >= 500) {
      logger.error(`[paymentReports] ${label} failed: ${error.message}`);
      return res.status(500).json({ success: false, message: 'Server error processing payment report' });
    }
    return res.status(status).json({ success: false, message: error.message });
  }
};

exports.listReports = handle('listReports', async (req, res) => {
  const { cursor, direction, limit } = parseKeysetQuery(req.query);
  const { status } = req.query;
  if (status && !Object.values(PaymentReportStatus).includes(status)) {
    return res.status(400).json({ success: false, message: `Invalid status '${status}'` });
  }
  const result = await paymentReportService.listReports({ cursor, direction, limit, status });
  res.json({ success: true, data: result.rows.map(toDto), pagination: toPaginationDto(result) });
});

exports.getReport = handle('getReport', async (req, res) => {
  const report = await paymentReportService.getReport(req.params.id);
  res.json({ success: true, data: toDto(report) });
});

exports.amendReport = handle('amendReport', async (req, res) => {
  const body = validated(req, res, schemas.amendPaymentReportSchema);
  if (!body) return;
  const report = await paymentReportService.amendReport(req.params.id, body, req.user, userAgentOf(req));
  res.json({ success: true, message: 'Payment report updated', data: toDto(report) });
});

exports.applyReport = handle('applyReport', async (req, res) => {
  const body = validated(req, res, schemas.reviewNotesSchema);
  if (!body) return;
  const report = await paymentReportService.applyReport(req.params.id, req.user, userAgentOf(req), body);
  res.json({ success: true, message: 'Payment applied to the loan', data: toDto(report) });
});

exports.rejectReport = handle('rejectReport', async (req, res) => {
  const body = validated(req, res, schemas.rejectPaymentReportSchema);
  if (!body) return;
  const report = await paymentReportService.rejectReport(req.params.id, req.user, body.reason, userAgentOf(req));
  res.json({ success: true, message: 'Payment report rejected', data: toDto(report) });
});
