const test = require('node:test');
const assert = require('node:assert');
const { assertCoSignerConsented } = require('../services/coSignerConsentGuard');

const loan = (coSignerConsentStatus, coSignerId = 7) => ({ coSignerId, coSignerConsentStatus });

test('blocks approval and disbursal unless the co-signer accepted', () => {
  for (const status of ['pending', 'declined', 'expired', 'superseded']) {
    assert.throws(() => assertCoSignerConsented(loan(status), 'approved', 409), /cannot be approved/);
    assert.throws(() => assertCoSignerConsented(loan(status), 'disbursed', 422), /cannot be disbursed/);
  }
});

test('declined consent has its own message and the requested status code', () => {
  assert.throws(
    () => assertCoSignerConsented(loan('declined'), 'approved', 409),
    (err) => /declined/.test(err.message) && err.statusCode === 409,
  );
});

test('accepted, loans without a co-signer, and legacy NULL status pass', () => {
  assert.doesNotThrow(() => assertCoSignerConsented(loan('accepted'), 'approved', 409));
  assert.doesNotThrow(() => assertCoSignerConsented(loan('pending', null), 'approved', 409));
  assert.doesNotThrow(() => assertCoSignerConsented(loan(null), 'disbursed', 422));
});
