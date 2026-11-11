const NotificationChannel = require('../../enums/notificationChannel');
const systemConfigService = require('../systemConfigService');

/** Default delivery channels for client-facing link messages. */
const DEFAULT_CLIENT_LINK_CHANNELS = [NotificationChannel.SMS, NotificationChannel.EMAIL];

/** Channels that make sense for a client (in-app/push need a staff user or device). */
const ALLOWED = new Set([NotificationChannel.SMS, NotificationChannel.WHATSAPP, NotificationChannel.EMAIL]);

/**
 * Channels for messages sent to clients/applicants outside the portal (registration invite
 * links, co-signer consent link and its outcome), from SystemConfig `notification.client_links.channels`
 * (JSON array of sms / whatsapp / email). Unknown values are ignored; empty/unset uses the default.
 * A channel still only fires if it is enabled globally and on the event's template.
 */
async function getClientLinkChannels() {
  const configured = await systemConfigService.getConfigValue(
    'notification.client_links.channels', 'json', DEFAULT_CLIENT_LINK_CHANNELS
  );
  const list = Array.isArray(configured) ? configured.filter((c) => ALLOWED.has(c)) : [];
  return list.length ? list : DEFAULT_CLIENT_LINK_CHANNELS;
}

module.exports = { DEFAULT_CLIENT_LINK_CHANNELS, getClientLinkChannels };
