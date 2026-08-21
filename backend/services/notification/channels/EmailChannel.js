const emailService = require('../../email/EmailService');

/**
 * EmailChannel — adapter used by outboxWorker for channel = 'email'.
 * @param {object} opts
 * @param {string} opts.to - Recipient email address
 * @param {string} [opts.subject]
 * @param {string} opts.body - Rendered HTML body
 */
async function send({ to, subject, body }) {
  return emailService.send({ to, subject: subject || '(no subject)', html: body, text: body });
}

module.exports = { send };
