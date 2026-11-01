const crypto = require('crypto');
const { Op } = require('sequelize');
const UserInvitation = require('../models/userInvitationModel');
const User = require('../models/userModel');
const Role = require('../models/roleModel');
const InvitationStatus = require('../enums/invitationStatus');
const NotificationEventType = require('../enums/notificationEventType');
const { buildRecipients, safeNotify } = require('./notification/notificationTriggers');
const systemConfigService = require('./systemConfigService');
const userService = require('./userService');
const logger = require('../config/logger');
const AuditLogger = require('../utils/auditLogger');
const { hasWildcardPermission } = require('../utils/permissionUtils');
const { normalizeRoleIds } = require('../utils/userRoles');
const { LOAN_NOTIFICATIONS_RECEIVER } = require('../constants/roles');

/** Invite link TTL in hours */
const TOKEN_EXPIRY_HOURS = 72;

/** Hash a raw token with SHA-256 so the DB never holds the plaintext value. */
const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

const buildInviteUrl = (rawToken) => {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${frontendUrl}/accept-invite?token=${rawToken}`;
};

/** Attaches `roleDetails` ([{id, name}]) to each invitation for response DTOs. */
async function attachRoleDetails(invitations) {
  const list = Array.isArray(invitations) ? invitations : [invitations];
  const ids = [...new Set(list.flatMap((i) => i.roleIds || []))];
  const roles = ids.length ? await Role.findAll({ where: { id: ids }, attributes: ['id', 'name'] }) : [];
  const byId = new Map(roles.map((r) => [r.id, { id: r.id, name: r.name }]));
  list.forEach((i) => {
    i.roleDetails = (i.roleIds || []).map((id) => byId.get(id)).filter(Boolean);
  });
  return invitations;
}

/**
 * Sends (or re-sends) the invitation email/SMS via the notification module,
 * and reports back whether the email channel is currently disabled so the
 * caller (controller) can surface a warning to the inviting admin.
 */
async function dispatchInvite(invitation, roles, rawToken) {
  const inviteUrl = buildInviteUrl(rawToken);
  const name = [invitation.firstName, invitation.lastName].filter(Boolean).join(' ') || invitation.email;
  const appName = process.env.APP_NAME || 'ARISLMS';

  const emailChannelEnabled = await systemConfigService.getConfigValue(
    'notification.channels.email.enabled', 'boolean', true
  );

  const recipients = buildRecipients({
    client: { email: invitation.email, ...(invitation.phone ? { phone: invitation.phone } : {}) },
  });

  await safeNotify(NotificationEventType.REGISTRATION_INVITE, {
    recipients,
    context: {
      name,
      inviteUrl,
      expiresHours: TOKEN_EXPIRY_HOURS,
      roleName: (roles || []).map((r) => r.name).join(', ') || 'user',
      appName,
    },
    // Fresh dedupeKey per send so a resend always queues a new outbox row
    // instead of being silently suppressed by the dedupe check.
    dedupeKey: `invite-${invitation.id}-${Date.now()}`,
  });

  const warnings = [];
  if (!emailChannelEnabled) {
    warnings.push(
      'Email notifications are currently disabled system-wide — the invite was not emailed. ' +
      'Share the link below manually or enable email notifications in System Configuration.'
    );
  }

  return { inviteUrl, warnings };
}

/**
 * Create a new invitation, invalidating any still-pending invite already
 * outstanding for the same email address.
 *
 * @param {object} data - validated InvitationRequestDto.createSchema payload
 * @param {number|null} inviterId
 * @param {string} [userAgent]
 * @param {string[]} [actorPermissions] - resolved permissions of the inviting user
 */
async function createInvitation(data, inviterId = null, userAgent = 'unknown', actorPermissions = []) {
  const email = data.email.toLowerCase();

  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    const err = new Error('A user with that email already exists');
    err.status = 409;
    throw err;
  }

  const roleIds = normalizeRoleIds(data.roles);
  const roles = roleIds.length ? await Role.findAll({ where: { id: roleIds } }) : [];
  if (!roleIds.length || roles.length !== roleIds.length) {
    const err = new Error('Invalid role');
    err.status = 400;
    throw err;
  }

  if (roles.every((r) => r.name === LOAN_NOTIFICATIONS_RECEIVER)) {
    const err = new Error(`"${LOAN_NOTIFICATIONS_RECEIVER}" must accompany a main role; select at least one other role`);
    err.status = 400;
    throw err;
  }

  if (roles.some((r) => hasWildcardPermission(r.permissions)) && !hasWildcardPermission(actorPermissions)) {
    const err = new Error('Only a Super Admin can invite another Super Admin');
    err.status = 403;
    throw err;
  }

  // Decline to create a duplicate invitation while an active (pending,
  // unexpired) one already exists for this email — the caller should
  // resend or revoke the existing invite instead.
  const activeInvitation = await UserInvitation.findOne({
    where: {
      email,
      status: InvitationStatus.PENDING,
      expiresAt: { [Op.gt]: new Date() },
    },
  });
  if (activeInvitation) {
    const err = new Error(
      'An active invitation already exists for this email address. Resend or revoke it before creating a new one.'
    );
    err.status = 409;
    throw err;
  }

  // Stale pending invites (expired but not yet swept) no longer count as
  // active, so mark them accordingly before issuing the new one.
  await UserInvitation.update(
    { status: InvitationStatus.EXPIRED },
    { where: { email, status: InvitationStatus.PENDING, expiresAt: { [Op.lte]: new Date() } } }
  );

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  const invitation = await UserInvitation.create({
    email,
    firstName: data.first_name || null,
    middleName: data.middle_name || null,
    lastName: data.last_name || null,
    phone: data.phone || null,
    roleIds,
    tokenHash,
    expiresAt,
    invitedBy: inviterId,
  });

  const { inviteUrl, warnings } = await dispatchInvite(invitation, roles, rawToken);

  await AuditLogger.log({
    entityType: 'USER_INVITATION',
    entityId: invitation.id,
    action: 'CREATE',
    data: { email, roles: roleIds },
    actorId: inviterId || 'system',
    options: { actorType: 'USER', source: userAgent },
  });

  logger.info(`[invitationService] Invitation created id=${invitation.id} email=${email} by user ${inviterId}`);

  invitation.roleDetails = roles.map((r) => ({ id: r.id, name: r.name }));
  return { invitation, inviteUrl, warnings };
}

/** List invitations, optionally filtered by status. */
async function listInvitations({ status } = {}) {
  const where = {};
  if (status) where.status = status;
  const invitations = await UserInvitation.findAll({
    where,
    order: [['created_at', 'DESC']],
  });
  return attachRoleDetails(invitations);
}

/** Marks stale PENDING invitations as EXPIRED and returns the freshest status. */
async function markExpiredIfDue(invitation) {
  if (invitation.status === InvitationStatus.PENDING && invitation.expiresAt < new Date()) {
    await invitation.update({ status: InvitationStatus.EXPIRED });
  }
  return invitation;
}

/**
 * Look up an invitation by its raw (plaintext) token for the public
 * "verify"/prefill step. Throws 404/400 on invalid, expired, or already-used
 * tokens.
 */
async function getInvitationByToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const invitation = await UserInvitation.findOne({ where: { tokenHash } });

  if (!invitation) {
    const err = new Error('Invalid invitation link');
    err.status = 404;
    throw err;
  }

  await markExpiredIfDue(invitation);

  if (invitation.status !== InvitationStatus.PENDING) {
    const messages = {
      [InvitationStatus.ACCEPTED]: 'This invitation has already been used',
      [InvitationStatus.REVOKED]: 'This invitation has been revoked',
      [InvitationStatus.EXPIRED]: 'This invitation has expired',
    };
    const err = new Error(messages[invitation.status] || 'This invitation is no longer valid');
    err.status = 400;
    throw err;
  }

  return attachRoleDetails(invitation);
}

/**
 * Complete a registration from a valid invite token — reuses
 * userService.createUser so the SAME validation/hashing/audit path as normal
 * admin-created users applies (id_number optional).
 *
 * @param {string} rawToken
 * @param {object} data - validated InvitationRequestDto.acceptSchema payload (minus token)
 * @param {string} [userAgent]
 */
async function completeInvitation(rawToken, data, userAgent = 'unknown') {
  const invitation = await getInvitationByToken(rawToken); // throws if invalid/expired/used

  const phone = data.phone || invitation.phone;
  if (!phone) {
    const err = new Error('Phone number is required to complete registration');
    err.status = 400;
    throw err;
  }

  const newUser = await userService.createUser({
    first_name: data.first_name,
    middle_name: data.middle_name || invitation.middleName || null,
    last_name: data.last_name,
    email: invitation.email,
    phone,
    roles: invitation.roleIds,
    id_number: data.id_number || null,
    password: data.password,
  }, null, userAgent, [], { skipSuperAdminGuard: true });

  await invitation.update({
    status: InvitationStatus.ACCEPTED,
    acceptedAt: new Date(),
    createdUserId: newUser.id,
  });

  await AuditLogger.log({
    entityType: 'USER_INVITATION',
    entityId: invitation.id,
    action: 'STATUS_CHANGE',
    data: { event: 'accepted', createdUserId: newUser.id },
    actorId: newUser.id,
    options: { actorType: 'USER', source: userAgent },
  });

  logger.info(`[invitationService] Invitation id=${invitation.id} accepted -> user id=${newUser.id}`);
  return newUser;
}

/** Regenerate the token/expiry for a still-pending invite and re-send it. */
async function resendInvitation(id, actorId = null, userAgent = 'unknown') {
  const invitation = await UserInvitation.findByPk(id);
  if (!invitation) {
    const err = new Error('Invitation not found');
    err.status = 404;
    throw err;
  }
  if (invitation.status !== InvitationStatus.PENDING) {
    const err = new Error('Only pending invitations can be resent');
    err.status = 400;
    throw err;
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
  await invitation.update({ tokenHash, expiresAt });

  await attachRoleDetails(invitation);
  const { inviteUrl, warnings } = await dispatchInvite(invitation, invitation.roleDetails, rawToken);

  await AuditLogger.log({
    entityType: 'USER_INVITATION',
    entityId: invitation.id,
    action: 'UPDATE',
    data: { event: 'resent' },
    actorId: actorId || 'system',
    options: { actorType: 'USER', source: userAgent },
  });

  logger.info(`[invitationService] Invitation id=${invitation.id} resent by user ${actorId}`);
  return { invitation, inviteUrl, warnings };
}

/** Revoke a still-pending invite so its link can no longer be used. */
async function revokeInvitation(id, actorId = null, userAgent = 'unknown') {
  const invitation = await UserInvitation.findByPk(id);
  if (!invitation) {
    const err = new Error('Invitation not found');
    err.status = 404;
    throw err;
  }
  if (invitation.status !== InvitationStatus.PENDING) {
    const err = new Error('Only pending invitations can be revoked');
    err.status = 400;
    throw err;
  }

  await invitation.update({ status: InvitationStatus.REVOKED, revokedAt: new Date() });
  await attachRoleDetails(invitation);

  await AuditLogger.log({
    entityType: 'USER_INVITATION',
    entityId: invitation.id,
    action: 'STATUS_CHANGE',
    data: { event: 'revoked' },
    actorId: actorId || 'system',
    options: { actorType: 'USER', source: userAgent },
  });

  logger.info(`[invitationService] Invitation id=${invitation.id} revoked by user ${actorId}`);
  return invitation;
}

module.exports = {
  createInvitation,
  listInvitations,
  getInvitationByToken,
  completeInvitation,
  resendInvitation,
  revokeInvitation,
};
