const whatsAppService = require('../../whatsapp/WhatsAppService');

/**
 * WhatsAppChannel — adapter used by outboxWorker for channel = 'whatsapp'.
 * @param {object} opts
 * @param {string} opts.to - Recipient phone number
 * @param {string} opts.body - Rendered message text
 */
async function send({ to, body }) {
  return whatsAppService.send({ to, body });
}

module.exports = { send };
