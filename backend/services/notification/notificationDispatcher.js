const logger = require('../../config/logger');
const NotificationTemplate = require('../../models/notificationTemplateModel');
const NotificationOutbox = require('../../models/notificationOutboxModel');
const NotificationChannel = require('../../enums/notificationChannel');
const NotificationDeliveryStatus = require('../../enums/notificationDeliveryStatus');
const systemConfigService = require('../systemConfigService');
const templateRenderer = require('./templateRenderer');

const ALL_CHANNELS = Object.values(NotificationChannel);

const CHANNEL_FIELD = {
  [NotificationChannel.EMAIL]: { enabled: 'emailEnabled', subject: 'emailSubject', body: 'emailBody' },
  [NotificationChannel.SMS]: { enabled: 'smsEnabled', subject: null, body: 'smsBody' },
  [NotificationChannel.IN_APP]: { enabled: 'inAppEnabled', subject: 'inAppTitle', body: 'inAppBody' },
  [NotificationChannel.PUSH]: { enabled: 'pushEnabled', subject: 'pushTitle', body: 'pushBody' },
};

/** Global on/off switch for a channel, from SystemConfig `notification.channels.<ch>.enabled`. Defaults ON. */
async function isChannelGloballyEnabled(channel) {
  return systemConfigService.getConfigValue(`notification.channels.${channel}.enabled`, 'boolean', true);
}

/** Pulls the destination address for a channel out of a recipient descriptor. */
function resolveDestination(channel, recipient) {
  switch (channel) {
    case NotificationChannel.EMAIL: return recipient.email || null;
    case NotificationChannel.SMS: return recipient.phone || null;
    case NotificationChannel.PUSH: return recipient.deviceToken || null;
    case NotificationChannel.IN_APP: return recipient.userId ? String(recipient.userId) : null;
    default: return null;
  }
}

/**
 * notificationDispatcher.notify — resolves a template + channels + recipients into
 * persisted NotificationOutbox rows (status QUEUED), which outboxWorker later sends.
 *
 * @param {string} eventKey - NotificationEventType value (e.g. 'payment_received')
 * @param {object} opts
 * @param {Array<{userId?:number, email?:string, phone?:string, deviceToken?:string}>} opts.recipients
 * @param {object} [opts.context] - Shared variable context rendered into `{{var}}` placeholders
 * @param {string[]} [opts.channels] - Restrict to a subset of channels (default: all template-enabled channels)
 * @param {number} [opts.relatedLoanId]
 * @param {number} [opts.relatedPaymentId]
 * @param {string} [opts.dedupeKey] - When set, skips creating a duplicate outbox row per (channel, recipient)
 *                                    if one already exists with the same dedupeKey and isn't SKIPPED/FAILED-final.
 * @param {number} [opts.priority] - Higher = sent first by outboxWorker (default 0). Use for time-sensitive
 *                                   messages such as login OTP codes.
 * @returns {Promise<{skipped:boolean, reason?:string, rows?:Array}>}
 */
async function notify(eventKey, {
  recipients = [],
  context = {},
  channels = null,
  relatedLoanId = null,
  relatedPaymentId = null,
  dedupeKey = null,
  priority = 0,
} = {}) {
  try {
    if (!eventKey) throw new Error('notify() requires an eventKey');
    if (!recipients.length) {
      logger.warn(`[notificationDispatcher] notify(${eventKey}) called with no recipients — skipping`);
      return { skipped: true, reason: 'no_recipients' };
    }

    const template = await NotificationTemplate.findOne({ where: { eventKey } });
    if (!template) {
      logger.warn(`[notificationDispatcher] No template found for eventKey="${eventKey}" — skipping`);
      return { skipped: true, reason: 'template_not_found' };
    }
    if (!template.isActive) {
      logger.info(`[notificationDispatcher] Template "${eventKey}" is inactive — skipping`);
      return { skipped: true, reason: 'template_inactive' };
    }

    const requestedChannels = channels && channels.length ? channels : ALL_CHANNELS;

    // Resolve which channels actually fire: requested ∩ template-enabled ∩ globally-enabled
    const resolvedChannels = [];
    for (const channel of ALL_CHANNELS) {
      if (!requestedChannels.includes(channel)) continue;
      const fields = CHANNEL_FIELD[channel];
      if (!template[fields.enabled]) continue;
      if (!(await isChannelGloballyEnabled(channel))) continue;
      resolvedChannels.push(channel);
    }

    if (!resolvedChannels.length) {
      logger.info(`[notificationDispatcher] No enabled channels resolved for "${eventKey}" — skipping`);
      return { skipped: true, reason: 'no_enabled_channels' };
    }

    const maxAttempts = await systemConfigService.getConfigValue('notification.outbox.maxAttempts', 'number', 5);
    const createdRows = [];

    for (const recipient of recipients) {
      for (const channel of resolvedChannels) {
        const destination = resolveDestination(channel, recipient);
        const fields = CHANNEL_FIELD[channel];
        const renderedSubject = fields.subject ? templateRenderer.render(template[fields.subject], context) : null;
        const renderedBody = templateRenderer.render(template[fields.body], context);

        if (!destination) {
          // No address/userId for this channel — record as SKIPPED for visibility, don't attempt delivery.
          createdRows.push(await NotificationOutbox.create({
            eventKey,
            channel,
            recipientUserId: recipient.userId || null,
            toAddress: null,
            renderedSubject,
            renderedBody,
            status: NotificationDeliveryStatus.SKIPPED,
            lastError: 'No destination address for recipient on this channel',
            relatedLoanId,
            relatedPaymentId,
            dedupeKey,
            priority,
          }));
          continue;
        }

        if (dedupeKey) {
          const existing = await NotificationOutbox.findOne({
            where: { dedupeKey, channel, eventKey, recipientUserId: recipient.userId || null, toAddress: destination },
          });
          if (existing) {
            logger.info(`[notificationDispatcher] Duplicate suppressed for dedupeKey="${dedupeKey}" channel=${channel}`);
            continue;
          }
        }

        createdRows.push(await NotificationOutbox.create({
          eventKey,
          channel,
          recipientUserId: recipient.userId || null,
          toAddress: destination,
          renderedSubject,
          renderedBody,
          status: NotificationDeliveryStatus.QUEUED,
          maxAttempts,
          relatedLoanId,
          relatedPaymentId,
          dedupeKey,
          priority,
        }));
      }
    }

    logger.info(`[notificationDispatcher] notify(${eventKey}) queued ${createdRows.length} outbox row(s)`);
    return { skipped: false, rows: createdRows };
  } catch (error) {
    // Notifications must never break the calling business flow (payment/loan services).
    logger.error(`[notificationDispatcher] notify(${eventKey}) failed: ${error.message}`);
    return { skipped: true, reason: 'error', error: error.message };
  }
}

module.exports = { notify, ALL_CHANNELS };
