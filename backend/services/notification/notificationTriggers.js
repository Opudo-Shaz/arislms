/**
 * notificationTriggers — small helper shared by loanService/paymentService/loanStatusCronJob
 * to build a recipients array for notificationDispatcher.notify() and to fire-and-forget
 * a notify() call so notification failures never break the calling business flow.
 */
const logger = require('../../config/logger');
const notificationDispatcher = require('./notificationDispatcher');

/**
 * @param {object} [opts]
 * @param {object} [opts.client] - Client instance/plain object with email/phone
 * @param {number} [opts.staffUserId] - User id (e.g. loan.createdBy) to notify in-app
 * @returns {Array<object>} recipients array for notificationDispatcher.notify
 */
function buildRecipients({ client, staffUserId } = {}) {
  const recipients = [];
  if (client && (client.email || client.phone)) {
    recipients.push({
      ...(client.email ? { email: client.email } : {}),
      ...(client.phone ? { phone: client.phone } : {}),
    });
  }
  if (staffUserId) {
    recipients.push({ userId: staffUserId });
  }
  return recipients;
}

/**
 * Fire-and-forget wrapper around notificationDispatcher.notify — swallows/logs
 * errors so a notification problem never fails the caller's business transaction.
 */
async function safeNotify(eventKey, opts) {
  try {
    return await notificationDispatcher.notify(eventKey, opts);
  } catch (error) {
    logger.error(`[notificationTriggers] safeNotify(${eventKey}) failed: ${error.message}`);
    return { skipped: true, reason: 'error', error: error.message };
  }
}

module.exports = { buildRecipients, safeNotify };
