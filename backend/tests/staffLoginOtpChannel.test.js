const test = require('node:test');
const assert = require('node:assert/strict');

const authService = require('../services/authService');
const smsService = require('../services/sms/SmsService');
const notificationDispatcher = require('../services/notification/notificationDispatcher');

const user = (over = {}) => ({ id: 1, email: 'jane@example.com', phone: '+254712345678', ...over });

/** Which channels the OTP template + global switches allow, and whether SMS has a real provider. */
function setup(t, { enabled = ['sms', 'whatsapp', 'email'], smsConfigured = true } = {}) {
  t.mock.method(notificationDispatcher, 'isChannelAvailable', async (_event, channel) => enabled.includes(channel));
  t.mock.method(smsService, 'isConfigured', async () => smsConfigured);
}

test('uses SMS by default and offers WhatsApp as the fallback', async (t) => {
  setup(t);
  assert.deepEqual(await authService.resolveLoginOtpChannel(user()), { channel: 'sms', alternative: 'whatsapp' });
});

test('SMS without a WhatsApp option has no alternative', async (t) => {
  setup(t, { enabled: ['sms', 'email'] });
  assert.deepEqual(await authService.resolveLoginOtpChannel(user()), { channel: 'sms', alternative: null });
});

test('stub SMS provider: WhatsApp when enabled', async (t) => {
  setup(t, { smsConfigured: false });
  assert.deepEqual(await authService.resolveLoginOtpChannel(user()), { channel: 'whatsapp', alternative: null });
});

test('stub SMS provider and WhatsApp disabled: email', async (t) => {
  setup(t, { smsConfigured: false, enabled: ['sms', 'email'] });
  assert.deepEqual(await authService.resolveLoginOtpChannel(user()), { channel: 'email', alternative: null });
});

test('a user without a phone number gets email', async (t) => {
  setup(t);
  assert.deepEqual(await authService.resolveLoginOtpChannel(user({ phone: null })), { channel: 'email', alternative: null });
});

test('a usable requested channel overrides the default (try WhatsApp instead)', async (t) => {
  setup(t);
  assert.deepEqual(await authService.resolveLoginOtpChannel(user(), 'whatsapp'), { channel: 'whatsapp', alternative: null });
});

test('an unusable requested channel falls back to the default', async (t) => {
  setup(t, { enabled: ['sms', 'email'] });
  assert.deepEqual(await authService.resolveLoginOtpChannel(user(), 'whatsapp'), { channel: 'sms', alternative: null });
});

test('no usable channel leaves routing to the template defaults', async (t) => {
  setup(t, { enabled: [] });
  assert.deepEqual(await authService.resolveLoginOtpChannel(user()), { channel: null, alternative: null });
});
