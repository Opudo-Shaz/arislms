const emailService = require('../../email/EmailService');
const { baseTemplate } = require('../../email/templates/base');

/**
 * EmailChannel — adapter used by outboxWorker for channel = 'email'.
 *
 * Wraps every rendered notification body in the shared `baseTemplate` layout
 * (logo header + card + footer) so ALL outgoing notification emails —
 * regardless of which template/event they came from — share consistent
 * branding, the same way transactional emails elsewhere in the app do.
 *
 * @param {object} opts
 * @param {string} opts.to - Recipient email address
 * @param {string} [opts.subject]
 * @param {string} opts.body - Rendered HTML body (template-specific content)
 */
async function send({ to, subject, body }) {
  const appName = process.env.APP_NAME || 'ARISLMS';
  const html = baseTemplate({ title: subject || appName, bodyContent: body, appName });

  return emailService.send({ to, subject: subject || '(no subject)', html, text: body });
}

module.exports = { send };
