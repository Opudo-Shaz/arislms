const logger = require('../../../config/logger');

/**
 * PushChannel — future-ready stub. No mobile app / FCM integration yet.
 * Always resolves with a 'skipped' result rather than throwing, since push
 * not being configured is expected today, not an error condition.
 */
async function send({ to, subject, body }) {
  logger.info(`[PushChannel] Push not implemented — skipping (to=${to}, subject=${subject})`);
  return { status: 'skipped', reason: 'push channel not implemented' };
}

module.exports = { send };
