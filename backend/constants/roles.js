/** Built-in role ids (seeded by convention; see scripts/seedDefaultPermissions.js). */
const ROLE_IDS = Object.freeze({ ADMIN: 1, MANAGER: 2, LIMITED: 3 });

/**
 * Companion role: attach it to a user's main role(s) so they receive staff-side
 * loan notifications (created, submitted, approved, rejected, ...), except for
 * actions they performed themselves. It carries no permissions and can never be
 * a user's only role.
 */
const LOAN_NOTIFICATIONS_RECEIVER = 'loan_notifications_receiver';

const LOAN_NOTIFICATIONS_RECEIVER_DESCRIPTION =
  'Companion role: receives admin-side loan notifications (loan created, request submitted, approved, rejected, disbursed, payments). Attach alongside a main role.';

module.exports = { ROLE_IDS, LOAN_NOTIFICATIONS_RECEIVER, LOAN_NOTIFICATIONS_RECEIVER_DESCRIPTION };
