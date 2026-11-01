const test = require('node:test');
const assert = require('node:assert/strict');

const Role = require('../models/roleModel');
const User = require('../models/userModel');
const UserRole = require('../models/userRoleModel');
const notificationDispatcher = require('../services/notification/notificationDispatcher');
const {
  getLoanNotificationReceivers,
  notifyLoanReceivers,
} = require('../services/notification/loanNotificationReceivers');

const stubDb = (t, { roleActive = true, userIds = [1, 2, 3] } = {}) => {
  t.mock.method(Role, 'findOne', async () => (roleActive ? { id: 9 } : null));
  t.mock.method(UserRole, 'findAll', async () => userIds.map((userId) => ({ userId })));
  // Mirrors the DB: only rows whose id is in the `id` filter come back.
  t.mock.method(User, 'findAll', async ({ where }) => {
    const wanted = where.id[Object.getOwnPropertySymbols(where.id)[0]];
    return wanted.map((id) => ({ id, email: `u${id}@test.com` }));
  });
  t.mock.method(User, 'findByPk', async () => ({ first_name: 'Act', last_name: 'Or' }));
};

test('receivers exclude the user who performed the action', async (t) => {
  stubDb(t);
  const receivers = await getLoanNotificationReceivers({ excludeUserId: 2 });
  assert.deepEqual(receivers.map((r) => r.userId), [1, 3]);
  assert.equal(receivers[0].email, 'u1@test.com');
});

test('receivers are empty when the role is missing or inactive', async (t) => {
  stubDb(t, { roleActive: false });
  assert.deepEqual(await getLoanNotificationReceivers(), []);
});

test('notifyLoanReceivers sends in-app + email to non-actors with the actor name', async (t) => {
  stubDb(t);
  const notify = t.mock.method(notificationDispatcher, 'notify', async () => ({ skipped: false, rows: [] }));

  await notifyLoanReceivers('staff_loan_approved', { actorUserId: 1, context: { referenceCode: 'R1' }, relatedLoanId: 5 });

  assert.equal(notify.mock.callCount(), 1);
  const [eventKey, opts] = notify.mock.calls[0].arguments;
  assert.equal(eventKey, 'staff_loan_approved');
  assert.deepEqual(opts.recipients.map((r) => r.userId), [2, 3]);
  assert.deepEqual(opts.channels, ['in_app', 'email']);
  assert.equal(opts.context.actorName, 'Act Or');
  assert.equal(opts.context.referenceCode, 'R1');
  assert.equal(opts.relatedLoanId, 5);
});

test('notifyLoanReceivers sends nothing when nobody holds the role', async (t) => {
  stubDb(t, { userIds: [] });
  const notify = t.mock.method(notificationDispatcher, 'notify', async () => ({ skipped: false, rows: [] }));

  const none = await notifyLoanReceivers('payment_report_submitted', { actorUserId: null });
  assert.equal(none.reason, 'no_recipients');
  assert.equal(notify.mock.callCount(), 0);
});

test('a client-initiated action (no actor) reaches every receiver', async (t) => {
  stubDb(t);
  const notify = t.mock.method(notificationDispatcher, 'notify', async () => ({ skipped: false, rows: [] }));

  await notifyLoanReceivers('payment_report_submitted', { actorUserId: null });
  assert.deepEqual(notify.mock.calls[0].arguments[1].recipients.map((r) => r.userId), [1, 2, 3]);
});

test('notifyLoanReceivers never throws', async (t) => {
  t.mock.method(Role, 'findOne', async () => { throw new Error('db down'); });
  const res = await notifyLoanReceivers('loan_created', { actorUserId: 1 });
  assert.equal(res.skipped, true);
  assert.equal(res.reason, 'error');
});
