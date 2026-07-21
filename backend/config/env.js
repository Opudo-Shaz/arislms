const path = require('node:path');
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');

function loadEnv(options = {}) {
  const envPath = options.path || path.resolve(__dirname, '../.env');
  const env = dotenv.config({ ...options, path: envPath });

  dotenvExpand.expand(env);
  return env;
}

module.exports = loadEnv;
