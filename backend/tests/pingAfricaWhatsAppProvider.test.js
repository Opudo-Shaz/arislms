const test = require('node:test');
const assert = require('node:assert/strict');

const PingAfricaWhatsAppProvider = require('../services/whatsapp/providers/PingAfricaWhatsAppProvider');

function mockFetch(t, response) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null });
    return { ok: response.ok !== false, status: response.status || 200, json: async () => response.body };
  });
  return calls;
}

const config = { apiToken: 'token', instanceName: 'my-instance', baseUrl: 'https://example.test/api/' };

test('requires an API token and an instance name', () => {
  assert.throws(() => new PingAfricaWhatsAppProvider({ instanceName: 'x' }), /API token/);
  assert.throws(() => new PingAfricaWhatsAppProvider({ apiToken: 'x' }), /instance/);
});

test('sends a text message with a digits-only E.164 number', async (t) => {
  const calls = mockFetch(t, { body: { key: { id: 'WA123' }, status: 'PENDING' } });
  const result = await new PingAfricaWhatsAppProvider(config).send({ to: '0712345678', body: 'Hello' });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://example.test/api/whatsapp/messages/text');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(calls[0].body, { instanceName: 'my-instance', number: '254712345678', text: 'Hello' });
  assert.equal(result.providerMessageId, 'WA123');
  assert.equal(result.status, 'PENDING');
});

test('rejects an empty body without calling the API', async (t) => {
  const calls = mockFetch(t, { body: {} });
  await assert.rejects(() => new PingAfricaWhatsAppProvider(config).send({ to: '0712345678', body: '  ' }), /empty/);
  assert.equal(calls.length, 0);
});

test('surfaces API errors', async (t) => {
  mockFetch(t, { ok: false, status: 404, body: { success: false, error: 'WhatsApp instance not found' } });
  await assert.rejects(
    () => new PingAfricaWhatsAppProvider(config).send({ to: '0712345678', body: 'Hi' }),
    /instance not found/
  );
});
