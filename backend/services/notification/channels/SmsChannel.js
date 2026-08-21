const smsService = require('../../sms/SmsService');

/**
 * SmsChannel — adapter used by outboxWorker for channel = 'sms'.
 * @param {object} opts
 * @param {string} opts.to - Recipient phone number
 * @param {string} opts.body - Rendered message text
 */
async function send({ to, body }) {
  return smsService.send({ to, body });
}

module.exports = { send };
