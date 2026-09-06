const { Op } = require('sequelize');
const logger = require('../../config/logger');
const NotificationOutbox = require('../../models/notificationOutboxModel');
const NotificationChannel = require('../../enums/notificationChannel');
const NotificationDeliveryStatus = require('../../enums/notificationDeliveryStatus');
const AuditLogger = require('../../utils/auditLogger');
const systemConfigService = require('../systemConfigService');

const EmailChannel = require('./channels/EmailChannel');
const SmsChannel = require('./channels/SmsChannel');
const InAppChannel = require('./channels/InAppChannel');
const PushChannel = require('./channels/PushChannel');

const ADAPTERS = {
  [NotificationChannel.EMAIL]: EmailChannel,
  [NotificationChannel.SMS]: SmsChannel,
  [NotificationChannel.IN_APP]: InAppChannel,
  [NotificationChannel.PUSH]: PushChannel,
};

/** Exponential backoff in seconds: base * 2^(attempts-1), capped at ~1 day. */
function computeBackoffMs(attempts, baseSeconds) {
  const seconds = Math.min(baseSeconds * Math.pow(2, Math.max(0, attempts - 1)), 24 * 60 * 60);
  return seconds * 1000;
}

async function sendOne(row) {
  const adapter = ADAPTERS[row.channel];
  if (!adapter) {
    await row.update({ status: NotificationDeliveryStatus.FAILED, lastError: `Unknown channel: ${row.channel}` });
    return;
  }

  // Flip to SENDING first — cheap concurrency guard so a second worker tick
  // (or process) won't pick up the same row while this one is in flight.
  await row.update({ status: NotificationDeliveryStatus.SENDING, attempts: row.attempts + 1 });

  try {
    const result = await adapter.send({
      to: row.toAddress,
      userId: row.recipientUserId,
      subject: row.renderedSubject,
      body: row.renderedBody,
      meta: {
        eventKey: row.eventKey,
        relatedLoanId: row.relatedLoanId,
        relatedPaymentId: row.relatedPaymentId,
      },
    });

    // PushChannel resolves (doesn't throw) with a 'skipped' status — respect that.
    const finalStatus = result && result.status === 'skipped'
      ? NotificationDeliveryStatus.SKIPPED
      : NotificationDeliveryStatus.SENT;

    await row.update({ status: finalStatus, lastError: result?.reason || null });
  } catch (err) {
    const baseBackoffSec = await systemConfigService.getConfigValue('notification.outbox.retryBackoffSec', 'number', 60);
    const attempts = row.attempts + 1; // already incremented above, but row.attempts was read before update; recompute safely
    const willRetry = attempts < row.maxAttempts;

    await row.update({
      status: NotificationDeliveryStatus.FAILED,
      lastError: err.message,
      nextAttemptAt: willRetry ? new Date(Date.now() + computeBackoffMs(attempts, baseBackoffSec)) : null,
    });

    logger.error(`[outboxWorker] Failed to send outbox row ${row.id} (${row.channel}, attempt ${attempts}/${row.maxAttempts}): ${err.message}`);

    if (!willRetry) {
      await AuditLogger.log({
        entityType: 'NOTIFICATION_OUTBOX',
        entityId: row.id,
        action: 'UPDATE',
        data: {
          status: NotificationDeliveryStatus.FAILED,
          eventKey: row.eventKey,
          channel: row.channel,
          toAddress: row.toAddress,
          error: err.message,
          finalFailure: true,
        },
        actorId: 1,
        options: { actorType: 'SYSTEM', source: 'outboxWorker' },
      });
    }
  }
}

/**
 * Processes a batch of due outbox rows: newly QUEUED rows, plus FAILED rows
 * whose nextAttemptAt has passed and haven't exhausted maxAttempts.
 * Registered as a cron job (see server.js / utils/cronRegistry).
 */
async function run({ batchSize = 50 } = {}) {
  const now = new Date();
  const rows = await NotificationOutbox.findAll({
    where: {
      [Op.or]: [
        { status: NotificationDeliveryStatus.QUEUED },
        {
          status: NotificationDeliveryStatus.FAILED,
          nextAttemptAt: { [Op.lte]: now },
        },
      ],
    },
    order: [['priority', 'DESC'], ['created_at', 'ASC']],
    limit: batchSize,
  });

  // Only rows that still have attempts remaining are actionable retries.
  const actionable = rows.filter(r => r.status === NotificationDeliveryStatus.QUEUED || r.attempts < r.maxAttempts);

  for (const row of actionable) {
    await sendOne(row);
  }

  return { processed: actionable.length };
}

module.exports = { run };
