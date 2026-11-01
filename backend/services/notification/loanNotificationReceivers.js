/**
 * Resolves the staff users who hold the `loan_notifications_receiver` role and
 * should be alerted about loan activity (created, submitted, approved, ...).
 * The user who performed the action is always excluded.
 */
const { Op } = require('sequelize');
const Role = require('../../models/roleModel');
const User = require('../../models/userModel');
const UserRole = require('../../models/userRoleModel');
const UserStatus = require('../../enums/userStatus');
const NotificationChannel = require('../../enums/notificationChannel');
const { LOAN_NOTIFICATIONS_RECEIVER } = require('../../constants/roles');
const logger = require('../../config/logger');
const { safeNotify } = require('./notificationTriggers');

/** Channels used for staff-side loan notifications. */
const STAFF_CHANNELS = [NotificationChannel.IN_APP, NotificationChannel.EMAIL];

/**
 * Active users holding the loan_notifications_receiver role, as notification
 * recipients ({ userId, email }), minus the acting user.
 * @param {object} [opts]
 * @param {number|null} [opts.excludeUserId] - the user who performed the action
 */
async function getLoanNotificationReceivers({ excludeUserId = null } = {}) {
  const role = await Role.findOne({
    where: { name: LOAN_NOTIFICATIONS_RECEIVER, isActive: true },
    attributes: ['id'],
  });
  if (!role) return [];

  const links = await UserRole.findAll({ where: { roleId: role.id }, attributes: ['userId'] });
  const userIds = [...new Set(links.map((l) => l.userId))]
    .filter((id) => excludeUserId === null || excludeUserId === undefined || Number(id) !== Number(excludeUserId));
  if (!userIds.length) return [];

  const users = await User.findAll({
    where: { id: { [Op.in]: userIds }, status: UserStatus.ACTIVE },
    attributes: ['id', 'email'],
  });
  return users.map((u) => ({ userId: u.id, ...(u.email ? { email: u.email } : {}) }));
}

/** Display name of the acting user for notification copy. */
async function getActorName(userId, fallback = 'A staff member') {
  if (!userId) return fallback;
  try {
    const user = await User.findByPk(userId, { attributes: ['first_name', 'middle_name', 'last_name'] });
    const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ');
    return name || fallback;
  } catch (error) {
    logger.warn(`[loanNotificationReceivers] could not resolve actor ${userId}: ${error.message}`);
    return fallback;
  }
}

/**
 * Best-effort: notifies every loan_notifications_receiver (except the actor).
 * Never throws — notification problems must not break the business flow.
 *
 * @param {string} eventKey
 * @param {object} opts
 * @param {number|null} [opts.actorUserId] - staff user who performed the action (excluded); null for client-initiated actions
 * @param {object} [opts.context] - template context; `actorName` is added automatically
 * @param {string[]} [opts.channels]
 * @param {number} [opts.relatedLoanId]
 * @param {number} [opts.relatedPaymentId]
 * @param {string} [opts.dedupeKey]
 */
async function notifyLoanReceivers(eventKey, {
  actorUserId = null,
  context = {},
  channels = STAFF_CHANNELS,
  relatedLoanId = null,
  relatedPaymentId = null,
  dedupeKey = null,
} = {}) {
  try {
    const recipients = await getLoanNotificationReceivers({ excludeUserId: actorUserId });
    if (!recipients.length) {
      logger.info(`[loanNotificationReceivers] no ${LOAN_NOTIFICATIONS_RECEIVER} users to notify for ${eventKey}`);
      return { skipped: true, reason: 'no_recipients' };
    }

    return await safeNotify(eventKey, {
      recipients,
      channels,
      context: { actorName: await getActorName(actorUserId), ...context },
      relatedLoanId,
      relatedPaymentId,
      dedupeKey,
    });
  } catch (error) {
    logger.error(`[loanNotificationReceivers] notifyLoanReceivers(${eventKey}) failed: ${error.message}`);
    return { skipped: true, reason: 'error', error: error.message };
  }
}

module.exports = {
  STAFF_CHANNELS,
  getLoanNotificationReceivers,
  notifyLoanReceivers,
};
