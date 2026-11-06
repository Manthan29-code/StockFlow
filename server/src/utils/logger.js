const config = require('../config');

const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LEVELS[config.LOG_LEVEL || 'info'] ?? 1;

function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

const logger = {
  debug(message, meta) {
    if (currentLevel <= LEVELS.debug) {
      console.debug(formatMessage('debug', message, meta));
    }
  },
  info(message, meta) {
    if (currentLevel <= LEVELS.info) {
      console.info(formatMessage('info', message, meta));
    }
  },
  warn(message, meta) {
    if (currentLevel <= LEVELS.warn) {
      console.warn(formatMessage('warn', message, meta));
    }
  },
  error(message, meta) {
    if (currentLevel <= LEVELS.error) {
      console.error(formatMessage('error', message, meta));
    }
  },
};

module.exports = logger;

