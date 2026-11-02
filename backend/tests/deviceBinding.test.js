const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { hashDeviceId, deviceHashFromRequest, idLast4Matches, lastFourOfId } = require('../utils/deviceId');
const Client = require('../models/clientModel');
const otpService = require('../services/otpService');
const clientDeviceService = require('../services/clientDeviceService');
const systemConfigService = require('../services/systemConfigService');
const AuditLogger = require('../utils/auditLogger');
const portalAuthService = require('../services/portalAuthService');

const SECRET = process.env.JWT_SECRET || 'secretkey';
const DEVICE_A = 'A'.repeat(43);
const DEVICE_B = 'B'.repeat(43);
const HASH_A = hashDeviceId(DEVICE_A);
const HASH_B = hashDeviceId(DEVICE_B);

const makeClient = (over = {}) => ({
  id: 7,
  firstName: 'Jane',
  lastName: 'Doe',
  email: null,
  status: 'active',
  isActive: true,
  portalEnabled: true,
  tokenVersion: 0,
  idDocumentNumber: '12-345 678',
  update: async () => {},
  ...over,
});

/** Patch object properties for one test and restore them afterwards. */
function stub(t, target, replacements) {
  for (const [key, value] of Object.entries(replacements)) t.mock.method(target, key, value);
}

function stubCommon(t, { client = makeClient(), trusted = false } = {}) {
  stub(t, Client, { findByPk: async () => client });
  stub(t, AuditLogger, { log: async () => {} });
  stub(t, clientDeviceService, {
    isTrusted: async () => trusted,
    touchDevice: async () => {},
    trustDevice: async () => {},
    clearStepUpFailures: async () => {},
    assertNotLocked: () => {},
  });
  return client;
}

const challenge = (dh, id = 7) => jwt.sign({ id, typ: 'client_otp', dh }, SECRET, { expiresIn: '5m' });

test('deviceHashFromRequest hashes a well-formed header and rejects junk', () => {
  assert.equal(deviceHashFromRequest({ headers: { 'x-device-id': DEVICE_A } }), HASH_A);
  assert.equal(deviceHashFromRequest({ headers: {} }), null);
  assert.equal(deviceHashFromRequest({ headers: { 'x-device-id': 'short' } }), null);
  assert.equal(deviceHashFromRequest({ headers: { 'x-device-id': `${DEVICE_A}!` } }), null);
});

test('idLast4Matches compares the last 4 alphanumerics, ignoring case and punctuation', () => {
  assert.equal(lastFourOfId('12-345 678'), '5678');
  assert.equal(idLast4Matches('12-345 678', '5678'), true);
  assert.equal(idLast4Matches('AB123456x', ' 456X'.trim()), true);
  assert.equal(idLast4Matches('12345678', '0000'), false);
  assert.equal(idLast4Matches('123', '0123'), false);
  assert.equal(idLast4Matches(null, '1234'), false);
});

test('verifyOtp rejects a challenge replayed from another device without touching the OTP', async (t) => {
  stubCommon(t);
  let verified = false;
  stub(t, otpService, { verify: async () => { verified = true; } });

  await assert.rejects(
    portalAuthService.verifyOtp({ otpToken: challenge(HASH_A), code: '123456' }, 'ua', { deviceHash: HASH_B }),
    (e) => e.status === 400 && /Invalid or expired verification code/.test(e.message)
  );
  assert.equal(verified, false);
});

test('verifyOtp passes the device hash through so the OTP lookup is device-scoped', async (t) => {
  stubCommon(t, { trusted: true });
  let seen;
  stub(t, otpService, { verify: async (args) => { seen = args; return true; } });

  const session = await portalAuthService.verifyOtp({ otpToken: challenge(HASH_A), code: '123456' }, 'ua', { deviceHash: HASH_A });
  assert.equal(seen.deviceHash, HASH_A);
  assert.equal(jwt.verify(session.token, SECRET).dh, HASH_A);
});

test('verifyOtp on an unrecognised device returns a step-up token instead of a session', async (t) => {
  stubCommon(t, { trusted: false });
  stub(t, otpService, { verify: async () => true });

  const result = await portalAuthService.verifyOtp({ otpToken: challenge(HASH_A), code: '123456' }, 'ua', { deviceHash: HASH_A });
  assert.equal(result.stepUpRequired, true);
  assert.equal(result.token, undefined);
  const payload = jwt.verify(result.stepUpToken, SECRET);
  assert.equal(payload.typ, 'client_device_stepup');
  assert.equal(payload.dh, HASH_A);
});

test('verifyOtp fails closed for a new device when the client has no ID number on file', async (t) => {
  stubCommon(t, { client: makeClient({ idDocumentNumber: null }), trusted: false });
  stub(t, otpService, { verify: async () => true });

  await assert.rejects(
    portalAuthService.verifyOtp({ otpToken: challenge(HASH_A), code: '123456' }, 'ua', { deviceHash: HASH_A }),
    (e) => e.status === 403 && e.code === 'DEVICE_STEP_UP_UNAVAILABLE'
  );
});

test('verifyDevice: wrong digits count an attempt and are rejected; right digits trust the device', async (t) => {
  stubCommon(t);
  let trusted = null;
  stub(t, clientDeviceService, {
    reserveStepUpAttempt: async () => ({ attempt: 1, maxAttempts: 5 }),
    trustDevice: async (args) => { trusted = args; },
  });
  const stepUpToken = jwt.sign({ id: 7, typ: 'client_device_stepup', dh: HASH_A }, SECRET, { expiresIn: '5m' });

  await assert.rejects(
    portalAuthService.verifyDevice({ stepUpToken, idLast4: '0000' }, 'ua', { deviceHash: HASH_A }),
    (e) => e.status === 400 && e.code === 'DEVICE_STEP_UP_FAILED'
  );
  assert.equal(trusted, null);

  const session = await portalAuthService.verifyDevice({ stepUpToken, idLast4: '5678' }, 'ua', { deviceHash: HASH_A });
  assert.equal(trusted.deviceHash, HASH_A);
  assert.equal(jwt.verify(session.token, SECRET).dh, HASH_A);
});

test('verifyDevice locks out once the attempt cap is reached, and refuses without comparing beyond it', async (t) => {
  stubCommon(t);
  let attempt = 5;
  stub(t, clientDeviceService, { reserveStepUpAttempt: async () => ({ attempt, maxAttempts: 5 }) });
  const stepUpToken = jwt.sign({ id: 7, typ: 'client_device_stepup', dh: HASH_A }, SECRET, { expiresIn: '5m' });

  await assert.rejects(
    portalAuthService.verifyDevice({ stepUpToken, idLast4: '0000' }, 'ua', { deviceHash: HASH_A }),
    (e) => e.status === 429 && e.code === 'DEVICE_STEP_UP_LOCKED'
  );
  attempt = 6;
  // Even the correct digits are refused once over the cap (concurrent-guess protection).
  await assert.rejects(
    portalAuthService.verifyDevice({ stepUpToken, idLast4: '5678' }, 'ua', { deviceHash: HASH_A }),
    (e) => e.status === 429
  );
});

test('verifyDevice rejects a step-up token presented from a different device', async (t) => {
  stubCommon(t);
  const stepUpToken = jwt.sign({ id: 7, typ: 'client_device_stepup', dh: HASH_A }, SECRET, { expiresIn: '5m' });
  await assert.rejects(
    portalAuthService.verifyDevice({ stepUpToken, idLast4: '5678' }, 'ua', { deviceHash: HASH_B }),
    (e) => e.status === 400
  );
});

test('requestOtp binds the code and challenge to the requesting device; a second device is not blocked by the cooldown', async (t) => {
  stub(t, systemConfigService, { getConfigValue: async (_k, _t, d) => d });
  stub(t, Client, { findAll: async () => [makeClient({ phone: '0712345678' })] });
  const issued = [];
  stub(t, otpService, {
    latestIssued: async () => ({ secondsAgo: 5, deviceHash: HASH_A }),
    generateAndSend: async (args) => { issued.push(args.deviceHash); },
  });

  // Same device inside the cooldown: no resend.
  const a = await portalAuthService.requestOtp({ phone: '0712345678', channel: 'sms' }, 'ua', { deviceHash: HASH_A });
  assert.deepEqual(issued, []);
  assert.equal(jwt.verify(a.otpToken, SECRET).dh, HASH_A);

  // Another device: fresh code bound to it, voiding the pending one.
  const b = await portalAuthService.requestOtp({ phone: '0712345678', channel: 'sms' }, 'ua', { deviceHash: HASH_B });
  assert.deepEqual(issued, [HASH_B]);
  assert.equal(jwt.verify(b.otpToken, SECRET).dh, HASH_B);
});

test('requestOtp requires a device id', async () => {
  await assert.rejects(
    portalAuthService.requestOtp({ phone: '0712345678', channel: 'sms' }, 'ua', {}),
    (e) => e.status === 400
  );
});

test('authenticateClient only accepts a session token from the device it was issued to', async (t) => {
  const { authenticateClient } = require('../middleware/authMiddleware');
  const appCache = require('../utils/appCache');
  appCache.del('auth:client:7');
  stub(t, Client, { findByPk: async () => ({ toJSON: () => makeClient() }) });
  stub(t, clientDeviceService, { isTrusted: async (_id, hash) => hash === HASH_A });

  const call = async (token, deviceId) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json() { return this; } };
    let nexted = false;
    const headers = { authorization: `Bearer ${token}` };
    if (deviceId) headers['x-device-id'] = deviceId;
    await authenticateClient({ headers }, res, () => { nexted = true; });
    return { nexted, status: res.statusCode };
  };
  const session = (dh) => jwt.sign({ id: 7, typ: 'client', tokenVersion: 0, ...(dh ? { dh } : {}) }, SECRET, { expiresIn: '1h' });

  assert.equal((await call(session(HASH_A), DEVICE_A)).nexted, true);
  assert.deepEqual(await call(session(HASH_A), DEVICE_B), { nexted: false, status: 401 });
  assert.deepEqual(await call(session(HASH_A), null), { nexted: false, status: 401 });
  assert.deepEqual(await call(session(null), DEVICE_A), { nexted: false, status: 401 });
  appCache.del('auth:client:7');
});

test('device DTO never exposes the device hash and flags the current device', () => {
  const ClientDeviceResponseDto = require('../dtos/clientDevice/ClientDeviceResponseDto');
  const row = { id: 3, deviceHash: HASH_A, userAgent: 'UA', lastIp: '1.2.3.4', trustedAt: 't', lastSeenAt: 's' };
  const mine = ClientDeviceResponseDto(row, { currentHash: HASH_A });
  assert.equal(mine.current, true);
  assert.equal('deviceHash' in mine, false);
  assert.equal(ClientDeviceResponseDto(row, { currentHash: HASH_B }).current, false);
  assert.equal(ClientDeviceResponseDto(row).current, false);
});

test('revoking a device is audited with the acting user and evicts the trust cache', async (t) => {
  const ClientDevice = require('../models/clientDeviceModel');
  const appCache = require('../utils/appCache');
  let updated = false;
  const logged = [];
  stub(t, ClientDevice, {
    findOne: async () => ({ id: 3, deviceHash: HASH_A, userAgent: 'UA', lastIp: '1.1.1.1', update: async () => { updated = true; } }),
  });
  stub(t, AuditLogger, { log: async (e) => { logged.push(e); } });
  appCache.set(`auth:device:7:${HASH_A}`, true);

  const ok = await clientDeviceService.revokeDevice(7, 3, { actorId: 99, actorType: 'USER', userAgent: 'admin-ui' });
  assert.equal(ok, true);
  assert.equal(updated, true);
  assert.equal(appCache.get(`auth:device:7:${HASH_A}`), undefined);
  assert.equal(logged[0].actorId, 99);
  assert.equal(logged[0].options.actorType, 'USER');
  assert.equal(logged[0].data.event, 'device_revoked');
});

test('staff device routes require the clients:manage_devices permission', async () => {
  const router = require('../routes/clientRoutes');
  const { PERMISSIONS, ALL_PERMISSIONS } = require('../constants/permissions');
  assert.ok(ALL_PERMISSIONS.includes('clients:manage_devices'));
  assert.equal(PERMISSIONS.CLIENTS.MANAGE_DEVICES, 'clients:manage_devices');

  const layers = router.stack.filter((l) => l.route && l.route.path.includes('/devices'));
  assert.equal(layers.length, 2);

  const run = async (layer, permissions) => {
    const guard = layer.route.stack[1].handle; // [authenticate, requirePermission(...), ...]
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json() { return this; } };
    let nexted = false;
    await guard({ user: { id: 1, permissions } }, res, () => { nexted = true; });
    return { nexted, status: res.statusCode };
  };
  for (const l of layers) {
    assert.equal((await run(l, ['clients:manage_devices'])).nexted, true, l.route.path);
    assert.equal((await run(l, ['*'])).nexted, true, l.route.path);
    assert.deepEqual(await run(l, ['clients:update']), { nexted: false, status: 403 }, l.route.path);
  }
});
