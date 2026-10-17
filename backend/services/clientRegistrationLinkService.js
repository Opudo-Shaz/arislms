const crypto = require('crypto');
const Joi = require('joi');
const { Op, fn, col } = require('sequelize');
const ClientRegistrationLink = require('../models/clientRegistrationLinkModel');
const Client = require('../models/clientModel');
const User = require('../models/userModel');
const LinkStatus = require('../enums/clientRegistrationLinkStatus');
const NotificationEventType = require('../enums/notificationEventType');
const NotificationChannel = require('../enums/notificationChannel');
const { safeNotify } = require('./notification/notificationTriggers');
const systemConfigService = require('./systemConfigService');
const AuditLogger = require('../utils/auditLogger');
const { encrypt, decrypt } = require('../utils/configEncryption');
const { normalizePhone } = require('../utils/phone');
const logger = require('../config/logger');

const DEFAULT_TTL_DAYS = 10;
const MAX_RECIPIENTS = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

const httpError = (message, status) => Object.assign(new Error(message), { status });
const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');
const isEmail = (v) => !Joi.string().email({ tlds: false }).validate(v).error;

const buildRegistrationUrl = (rawToken) => {
  const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${base}/register/client?token=${rawToken}`;
};

const effectiveStatus = (link) => {
  if (link.status === LinkStatus.REVOKED) return LinkStatus.REVOKED;
  return new Date(link.expiresAt) <= new Date() ? LinkStatus.EXPIRED : LinkStatus.ACTIVE;
};

/** Split a mixed list of emails/phones into normalised, de-duplicated destinations. */
function parseRecipients(list = []) {
  const emails = new Set();
  const phones = new Set();
  const invalid = [];
  for (const raw of list) {
    const value = String(raw || '').trim();
    if (!value) continue;
    if (value.includes('@')) {
      if (isEmail(value)) emails.add(value.toLowerCase());
      else invalid.push(value);
    } else {
      const phone = normalizePhone(value);
      if (phone) phones.add(phone);
      else invalid.push(value);
    }
  }
  if (invalid.length) {
    throw httpError(`These recipients are not a valid email or phone number: ${invalid.slice(0, 5).join(', ')}`, 400);
  }
  if (emails.size + phones.size > MAX_RECIPIENTS) {
    throw httpError(`At most ${MAX_RECIPIENTS} recipients can be sent a link at once`, 400);
  }
  return { emails: [...emails], phones: [...phones] };
}

/** Recipients are only used here to queue messages; nothing about them is stored. */
async function dispatch(link, rawToken, { emails, phones }) {
  const appName = process.env.APP_NAME || 'ARISLMS';
  const context = {
    appName,
    registrationUrl: buildRegistrationUrl(rawToken),
    expiresOn: new Date(link.expiresAt).toISOString().slice(0, 10),
  };

  const send = (recipient, channel) =>
    safeNotify(NotificationEventType.CLIENT_REGISTRATION_INVITE, {
      recipients: [recipient],
      context,
      channels: [channel],
      dedupeKey: `client-reg-link-${link.id}-${channel}-${recipient.email || recipient.phone}`,
    });

  await Promise.all([
    ...emails.map((email) => send({ email }, NotificationChannel.EMAIL)),
    ...phones.map((phone) => send({ phone }, NotificationChannel.SMS)),
  ]);

  const warnings = [];
  if (emails.length) {
    const on = await systemConfigService.getConfigValue('notification.channels.email.enabled', 'boolean', true);
    if (!on) warnings.push('Email notifications are disabled system-wide, so the emails were not sent.');
  }
  if (phones.length) {
    const on = await systemConfigService.getConfigValue('notification.channels.sms.enabled', 'boolean', true);
    if (!on) warnings.push('SMS notifications are disabled system-wide, so the messages were not sent.');
  }
  return warnings;
}

async function getTtlDays() {
  const days = await systemConfigService.getConfigValue('client.registration.link_ttl_days', 'number', DEFAULT_TTL_DAYS);
  return Math.min(90, Math.max(1, Math.floor(days || DEFAULT_TTL_DAYS)));
}

/**
 * @param {{label?: string, recipients?: string[]}} data
 * @returns {Promise<{link: ClientRegistrationLink, url: string, warnings: string[], sent: {email: number, sms: number}}>}
 */
async function createLink(data, actorId = null, userAgent = 'unknown') {
  const recipients = parseRecipients(data.recipients);

  const rawToken = crypto.randomBytes(32).toString('base64url');
  const link = await ClientRegistrationLink.create({
    label: data.label || null,
    tokenHash: hashToken(rawToken),
    tokenEncrypted: encrypt(rawToken),
    expiresAt: new Date(Date.now() + (await getTtlDays()) * DAY_MS),
    createdBy: actorId,
  });

  const warnings = await dispatch(link, rawToken, recipients);

  await AuditLogger.log({
    entityType: 'CLIENT_REGISTRATION_LINK',
    entityId: link.id,
    action: 'CREATE',
    data: { label: link.label, expiresAt: link.expiresAt, emailRecipients: recipients.emails.length, smsRecipients: recipients.phones.length },
    actorId: actorId || AuditLogger.SYSTEM_USER_ID,
    options: { actorType: 'USER', source: userAgent },
  });

  logger.info(`[clientRegistrationLink] created id=${link.id} by user ${actorId}`);
  return {
    link,
    url: buildRegistrationUrl(rawToken),
    warnings,
    sent: { email: recipients.emails.length, sms: recipients.phones.length },
  };
}

async function usageCounts(ids) {
  if (!ids.length) return new Map();
  const rows = await Client.findAll({
    attributes: ['registrationLinkId', [fn('COUNT', col('id')), 'count']],
    where: { registrationLinkId: { [Op.in]: ids } },
    group: [col('registration_link_id')],
    raw: true,
  });
  return new Map(rows.map((r) => [Number(r.registrationLinkId), Number(r.count)]));
}

async function creatorNames(links) {
  const ids = [...new Set(links.map((l) => l.createdBy).filter(Boolean))];
  if (!ids.length) return new Map();
  const users = await User.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'first_name', 'last_name'] });
  return new Map(users.map((u) => [u.id, [u.first_name, u.last_name].filter(Boolean).join(' ')]));
}

const toView = (link, usedCount, creators) => ({
  id: link.id,
  label: link.label,
  status: effectiveStatus(link),
  expiresAt: link.expiresAt,
  revokedAt: link.revokedAt,
  createdAt: link.created_at,
  createdBy: link.createdBy,
  createdByName: creators.get(link.createdBy) || null,
  usedCount,
});

async function summarize(link) {
  const [counts, creators] = await Promise.all([usageCounts([link.id]), creatorNames([link])]);
  return toView(link, counts.get(link.id) || 0, creators);
}

async function listLinks({ status } = {}) {
  const links = await ClientRegistrationLink.findAll({ order: [['created_at', 'DESC']] });
  const [counts, creators] = await Promise.all([usageCounts(links.map((l) => l.id)), creatorNames(links)]);
  const views = links.map((l) => toView(l, counts.get(l.id) || 0, creators));
  return status ? views.filter((v) => v.status === status) : views;
}

async function findOrFail(id) {
  const link = await ClientRegistrationLink.findByPk(id);
  if (!link) throw httpError('Registration link not found', 404);
  return link;
}

/** Link plus the clients who registered through it. */
async function getLink(id) {
  const link = await findOrFail(id);
  const clients = await Client.findAll({
    where: { registrationLinkId: link.id },
    attributes: ['id', 'accountNumber', 'firstName', 'lastName', 'email', 'phone', 'status', 'kycStatus', 'created_at'],
    order: [['created_at', 'DESC']],
  });
  const creators = await creatorNames([link]);
  return {
    ...toView(link, clients.length, creators),
    clients: clients.map((c) => ({
      id: c.id,
      accountNumber: c.accountNumber,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      status: c.status,
      kycStatus: c.kycStatus,
      registeredAt: c.created_at,
    })),
  };
}

async function getLinkUrl(id) {
  const link = await findOrFail(id);
  return buildRegistrationUrl(decrypt(link.tokenEncrypted));
}

async function revokeLink(id, actorId = null, userAgent = 'unknown') {
  const link = await findOrFail(id);
  if (link.status === LinkStatus.REVOKED) throw httpError('This link is already revoked', 400);

  await link.update({ status: LinkStatus.REVOKED, revokedAt: new Date(), revokedBy: actorId });

  await AuditLogger.log({
    entityType: 'CLIENT_REGISTRATION_LINK',
    entityId: link.id,
    action: 'STATUS_CHANGE',
    data: { event: 'revoked' },
    actorId: actorId || AuditLogger.SYSTEM_USER_ID,
    options: { actorType: 'USER', source: userAgent },
  });
  logger.info(`[clientRegistrationLink] revoked id=${link.id} by user ${actorId}`);
  return link;
}

/** Resolve a raw public token to a usable link or throw 404 / 403 / 410. */
async function resolveToken(rawToken) {
  if (typeof rawToken !== 'string' || rawToken.length < 20 || rawToken.length > 128) {
    throw httpError('This registration link is not valid', 404);
  }
  const link = await ClientRegistrationLink.findOne({ where: { tokenHash: hashToken(rawToken) } });
  if (!link) throw httpError('This registration link is not valid', 404);

  const status = effectiveStatus(link);
  if (status === LinkStatus.REVOKED) throw httpError('This registration link has been revoked', 403);
  if (status === LinkStatus.EXPIRED) throw httpError('This registration link has expired', 410);
  return link;
}

module.exports = { createLink, listLinks, summarize, getLink, getLinkUrl, revokeLink, resolveToken };
