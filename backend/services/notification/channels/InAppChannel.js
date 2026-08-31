const notificationService = require('../../notificationService');
const AuditLogger = require('../../../utils/auditLogger');

/**
 * InAppChannel — adapter used by outboxWorker for channel = 'in_app'.
 * Writes a Notification row via the existing notificationService so the
 * in-app inbox / GET /api/notifications endpoint keeps working unchanged.
 *
 * @param {object} opts
 * @param {number} opts.userId - Recipient user id
 * @param {string} opts.subject - Notification title
 * @param {string} opts.body - Notification message
 * @param {object} [opts.meta]
 * @param {string} [opts.meta.eventKey]
 * @param {string} [opts.meta.type] - Notification.type enum value (info/loan/payment/warning/reminder)
 * @param {number} [opts.meta.relatedLoanId]
 * @param {number} [opts.meta.relatedPaymentId]
 */
async function send({ userId, subject, body, meta = {} }) {
  if (!userId) throw new Error('InAppChannel requires a recipient userId');

  return notificationService.createNotification({
    userId,
    title: subject || '(no title)',
    message: body || '',
    type: meta.type || 'info',
    channel: 'in_app',
    eventKey: meta.eventKey || null,
    relatedLoanId: meta.relatedLoanId || null,
    relatedPaymentId: meta.relatedPaymentId || null,
  }, AuditLogger.SYSTEM_USER_ID, 'system:notification-dispatcher');
}

module.exports = { send };
