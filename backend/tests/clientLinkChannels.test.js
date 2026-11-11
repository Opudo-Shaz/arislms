const test = require('node:test');
const assert = require('node:assert/strict');

const systemConfigService = require('../services/systemConfigService');
const { getClientLinkChannels } = require('../services/notification/clientLinkChannels');

const withConfig = (t, value) => t.mock.method(systemConfigService, 'getConfigValue', async (_k, _t, def) => (value === undefined ? def : value));

test('defaults to sms + email when unset', async (t) => {
  withConfig(t, undefined);
  assert.deepEqual(await getClientLinkChannels(), ['sms', 'email']);
});

test('uses configured channels and drops unsupported ones', async (t) => {
  withConfig(t, ['whatsapp', 'sms', 'push', 'in_app', 'nope']);
  assert.deepEqual(await getClientLinkChannels(), ['whatsapp', 'sms']);
});

test('falls back to the default when nothing valid is configured', async (t) => {
  withConfig(t, ['push']);
  assert.deepEqual(await getClientLinkChannels(), ['sms', 'email']);
});
