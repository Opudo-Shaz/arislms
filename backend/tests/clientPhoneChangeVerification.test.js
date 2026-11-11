const test = require('node:test');
const assert = require('node:assert/strict');

const Client = require('../models/clientModel');
const AuditLogger = require('../utils/auditLogger');
const otpService = require('../services/clientRegistrationOtpService');
const clientService = require('../services/clientService');

const stub = (t) => {
  const client = { phone: '+254712345678', secondaryPhone: null, toJSON: () => ({}), update: t.mock.fn(async () => {}) };
  t.mock.method(Client, 'findByPk', async () => client);
  t.mock.method(AuditLogger, 'log', async () => {});
  const assertVerified = t.mock.method(otpService, 'assertVerified', async () => {});
  return { client, assertVerified };
};

test('changing the primary phone requires verification and never stores the token', async (t) => {
  const { client, assertVerified } = stub(t);
  await clientService.updateClient(1, { phone: '+254722000111', phoneVerificationToken: 'tok' }, 5);

  assert.deepEqual(assertVerified.mock.calls[0].arguments, ['+254722000111', 'tok']);
  assert.deepEqual(client.update.mock.calls[0].arguments[0], { phone: '+254722000111' });
});

test('a failed verification blocks the update', async (t) => {
  const { client, assertVerified } = stub(t);
  assertVerified.mock.mockImplementation(async () => { throw new Error('Phone verification is required'); });

  await assert.rejects(() => clientService.updateClient(1, { phone: '+254722000111' }, 5), /verification is required/);
  assert.equal(client.update.mock.callCount(), 0);
});

test('resubmitting the same phone (any format) or omitting it needs no verification', async (t) => {
  const { assertVerified } = stub(t);
  await clientService.updateClient(1, { phone: '0712345678', firstName: 'A' }, 5);
  await clientService.updateClient(1, { firstName: 'B' }, 5);
  assert.equal(assertVerified.mock.callCount(), 0);
});
