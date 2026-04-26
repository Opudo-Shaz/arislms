const { createLogger, transports, format } = require('winston');

/**
 * Walks up the Error stack to find the first frame outside this file.
 * Returns a string like "userService.js:34 [createUser]".
 */
function getCallerInfo() {
  const lines = new Error().stack.split('\n');
  const thisFile = __filename;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(thisFile)) continue;

    const match = line.match(/at (?:(.+?) \()?(.+):(\d+):\d+\)?/);
    if (!match) continue;

    const fnName = match[1] && match[1] !== 'Object.<anonymous>' ? match[1] : null;
    const fileName = match[2].split('/').pop();
    const lineNo = match[3];

    return fnName ? `${fileName}:${lineNo} [${fnName}]` : `${fileName}:${lineNo}`;
  }

  return 'unknown';
}

const winstonLogger = createLogger({
  level: 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'logs/app.log' }),
  ],
});

const logger = {
  info:  (msg, ...args) => winstonLogger.info(`[${getCallerInfo()}] ${msg}`, ...args),
  warn:  (msg, ...args) => winstonLogger.warn(`[${getCallerInfo()}] ${msg}`, ...args),
  error: (msg, ...args) => winstonLogger.error(`[${getCallerInfo()}] ${msg}`, ...args),
  debug: (msg, ...args) => winstonLogger.debug(`[${getCallerInfo()}] ${msg}`, ...args),
};

module.exports = logger;
