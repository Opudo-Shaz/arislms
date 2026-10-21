const test = require('node:test');
const assert = require('node:assert/strict');

const { liveness, createReadinessHandler, timeInfo } = require('../controllers/healthController');

const mockRes = () => {
  const res = { headers: {}, statusCode: null, body: null };
  res.set = (k, v) => { res.headers[k] = v; return res; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

test('liveness returns 200 ok without caching', () => {
  const res = mockRes();
  liveness({}, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'ok');
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.match(res.body.timestamp, /^\d{4}-\d{2}-\d{2}T[\d:.]+[+-]\d{2}:\d{2}$/);
  assert.ok(res.body.timezone);
});

test('timeInfo renders time in the requested timezone with its offset', () => {
  const instant = new Date('2026-10-21T06:01:37.354Z');
  assert.deepEqual(timeInfo(instant, 'Africa/Nairobi'), {
    timezone: 'Africa/Nairobi',
    timestamp: '2026-10-21T09:01:37.354+03:00',
    utcOffset: '+03:00',
  });
  assert.equal(timeInfo(instant, 'America/New_York').timestamp, '2026-10-21T02:01:37.354-04:00');
  assert.equal(timeInfo(instant, 'Asia/Kolkata').utcOffset, '+05:30');
});

test('timeInfo falls back to Africa/Nairobi for an invalid timezone', () => {
  assert.equal(timeInfo(new Date(), 'Not/AZone').timezone, 'Africa/Nairobi');
});

test('readiness returns 200 when the database is up', async () => {
  const res = mockRes();
  await createReadinessHandler({ ping: async () => {} })({}, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.checks, { database: 'up' });
});

test('readiness returns 503 when the database check fails or times out', async () => {
  const failing = mockRes();
  await createReadinessHandler({ ping: async () => { throw new Error('boom'); } })({}, failing);
  assert.equal(failing.statusCode, 503);
  assert.equal(failing.body.status, 'unavailable');
  assert.deepEqual(failing.body.checks, { database: 'down' });

  const hanging = mockRes();
  await createReadinessHandler({ ping: () => new Promise(() => {}), timeoutMs: 20 })({}, hanging);
  assert.equal(hanging.statusCode, 503);
});

test('readiness caches results and coalesces concurrent checks', async () => {
  let calls = 0;
  let clock = 0;
  const handler = createReadinessHandler({ ping: async () => { calls += 1; }, cacheMs: 1000, now: () => clock });

  await Promise.all([handler({}, mockRes()), handler({}, mockRes()), handler({}, mockRes())]);
  assert.equal(calls, 1);

  clock = 500;
  await handler({}, mockRes());
  assert.equal(calls, 1);

  clock = 1500;
  await handler({}, mockRes());
  assert.equal(calls, 2);
});
