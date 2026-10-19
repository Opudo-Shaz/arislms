const smsService = require('../../sms/SmsService');

/**
 * SmsChannel — adapter used by outboxWorker for channel = 'sms'.
 * @param {object} opts
 * @param {string} opts.to - Recipient phone number
 * @param {string} opts.body - Rendered message text
 * @param {{outboxId?: number}} [opts.meta]
 */
async function send({ to, body, meta }) {
  return smsService.send({ to, body, outboxId: meta?.outboxId });
}

module.exports = { send };
