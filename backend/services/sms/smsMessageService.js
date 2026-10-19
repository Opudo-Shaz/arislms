const { Op } = require('sequelize');
const logger = require('../../config/logger');
const SmsMessage = require('../../models/smsMessageModel');
const SmsWebhookEvent = require('../../models/smsWebhookEventModel');
const NotificationOutbox = require('../../models/notificationOutboxModel');
const NotificationDeliveryStatus = require('../../enums/notificationDeliveryStatus');
const SmsMessageStatus = require('../../enums/smsMessageStatus');
const { normalizePhone } = require('../../utils/phone');

// A message never moves backwards; delivered/failed are terminal.
const RANK = {
  [SmsMessageStatus.SUBMITTED]: 0,
  [SmsMessageStatus.SENT]: 1,
  [SmsMessageStatus.DELIVERED]: 2,
  [SmsMessageStatus.FAILED]: 2,
};

const EVENT_STATUS = {
  'sms.sent': SmsMessageStatus.SENT,
  'sms.delivered': SmsMessageStatus.DELIVERED,
  'sms.failed': SmsMessageStatus.FAILED,
};

const toRecipient = (value) => (value ? normalizePhone(value) || String(value).trim() : null);
const toDate = (value) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

/**
 * Apply one gateway event to a message row (idempotent, never regresses state).
 * @param {SmsMessage} message
 * @param {{event: string, timestamp?: string, data: object}} evt
 */
async function applyEvent(message, { event, timestamp, data = {} }) {
  const status = EVENT_STATUS[event];
  if (!status) return;

  const updates = {};
  if (!message.providerMessageId && data.message_id) updates.providerMessageId = String(data.message_id);
  if (message.parts == null && data.parts != null) updates.parts = Number(data.parts);
  if (message.cost == null && data.cost != null) updates.cost = data.cost;

  if (RANK[status] > RANK[message.status]) {
    updates.status = status;
    if (status === SmsMessageStatus.SENT) updates.sentAt = toDate(timestamp) || new Date();
    if (status === SmsMessageStatus.DELIVERED) {
      updates.deliveredAt = toDate(data.delivered_at) || toDate(timestamp) || new Date();
    }
    if (status === SmsMessageStatus.FAILED) {
      updates.failedAt = toDate(data.failed_at) || toDate(timestamp) || new Date();
      updates.failureReason = data.failure_reason || 'Delivery failed';
    }
  }

  if (Object.keys(updates).length === 0) return;
  await message.update(updates);

  // The outbox only knows the gateway accepted the message; surface a later
  // carrier failure there. No nextAttemptAt: re-sending could duplicate a message.
  if (updates.status === SmsMessageStatus.FAILED && message.outboxId) {
    await NotificationOutbox.update(
      { status: NotificationDeliveryStatus.FAILED, lastError: `SMS delivery failed: ${updates.failureReason}`, nextAttemptAt: null },
      { where: { id: message.outboxId } }
    );
  }
}

/** Find the message a webhook refers to: by gateway message id, else by batch + recipient. */
async function findMessage(provider, { messageId, batchId, recipient }) {
  if (messageId) {
    const byId = await SmsMessage.findOne({ where: { provider, providerMessageId: String(messageId) } });
    if (byId) return byId;
  }
  if (batchId && recipient) {
    return SmsMessage.findOne({ where: { provider, batchId: String(batchId), recipient } });
  }
  return null;
}

/** Re-apply webhook events that arrived before this message row existed. */
async function reconcile(provider, messages) {
  for (const message of messages) {
    const or = [];
    if (message.providerMessageId) or.push({ providerMessageId: message.providerMessageId });
    if (message.batchId) or.push({ batchId: message.batchId, recipient: message.recipient });
    if (!or.length) continue;

    const pending = await SmsWebhookEvent.findAll({
      where: { provider, matched: false, [Op.or]: or },
      order: [['event_timestamp', 'ASC'], ['id', 'ASC']],
    });
    for (const evt of pending) {
      await applyEvent(message, { event: evt.event, timestamp: evt.eventTimestamp, data: evt.payload?.data });
      await evt.update({ matched: true });
    }
  }
}

const smsMessageService = {
  applyEvent,
  findMessage,
  toRecipient,
  toDate,

  /**
   * Record a single-send result. Never throws: the SMS has already left, and a
   * tracking failure must not make the caller retry (and double-send).
   */
  async recordSent({ provider, to, result, outboxId = null }) {
    try {
      const message = await SmsMessage.create({
        provider,
        providerMessageId: result.providerMessageId,
        recipient: toRecipient(to),
        status: SmsMessageStatus.SENT,
        parts: result.parts,
        cost: result.cost,
        sentAt: new Date(),
        outboxId,
      });
      await reconcile(provider, [message]);
      return message;
    } catch (err) {
      logger.error(`[smsMessageService] recordSent failed: ${err.message}`);
      return null;
    }
  },

  /** Record bulk batches (one row per recipient). Never throws, see recordSent. */
  async recordBatches({ provider, batches }) {
    try {
      for (const batch of batches) {
        const rows = await SmsMessage.bulkCreate(
          batch.recipients.map((recipient) => ({
            provider,
            batchId: batch.batchId,
            recipient: toRecipient(recipient),
            status: SmsMessageStatus.SUBMITTED,
          }))
        );
        // Webhooks for a batch can beat this insert; skip the per-row lookups when none did.
        const early = await SmsWebhookEvent.count({ where: { provider, matched: false, batchId: batch.batchId } });
        if (early > 0) await reconcile(provider, rows);
      }
    } catch (err) {
      logger.error(`[smsMessageService] recordBatches failed: ${err.message}`);
    }
  },
};

module.exports = smsMessageService;
