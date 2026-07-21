const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const loadEnv = require('../config/env');

test('loadEnv expands referenced values from .env files', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arislms-env-'));
  const envFile = path.join(tempDir, '.env');

  fs.writeFileSync(envFile, 'ROOT_DIR=/tmp/app\nDATA_DIR=${ROOT_DIR}/data\n');

  try {
    loadEnv({ path: envFile });

    assert.equal(process.env.ROOT_DIR, '/tmp/app');
    assert.equal(process.env.DATA_DIR, '/tmp/app/data');
  } finally {
    delete process.env.ROOT_DIR;
    delete process.env.DATA_DIR;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
