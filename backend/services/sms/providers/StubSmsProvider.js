const logger = require('../../../config/logger');

/**
 * StubSmsProvider — placeholder until a real SMS gateway is integrated.
 * Logs the attempt and throws so the outbox worker records it as FAILED
 * (with retries) instead of silently pretending to deliver.
 */
class StubSmsProvider {
  async send({ to, body }) {
    logger.warn(`[StubSmsProvider] SMS not sent (no provider configured) — to=${to} body="${body}"`);
    throw new Error('SMS provider not configured. Set sms.provider in System Config to a supported gateway.');
  }
}

module.exports = StubSmsProvider;
