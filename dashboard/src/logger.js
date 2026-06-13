import { recordLog, recordError } from './store.js';

const COLORS = {
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  debug: '\x1b[90m',
  reset: '\x1b[0m',
};

function write(level, source, message) {
  const color = COLORS[level] || '';
  console.log(`${color}[${level.toUpperCase()}]${COLORS.reset} (${source}) ${message}`);
  try {
    recordLog({ level, source, message });
  } catch {
    // Never let logging crash the app.
  }
}

export const logger = {
  info: (message, source = 'app') => write('info', source, message),
  warn: (message, source = 'app') => write('warn', source, message),
  debug: (message, source = 'app') => write('debug', source, message),
  error: (message, source = 'app', err) => {
    write('error', source, message);
    try {
      recordError({
        source,
        message: err?.message ? `${message}: ${err.message}` : message,
        stack: err?.stack ?? null,
      });
    } catch {
      // ignore
    }
  },
};

// Capture otherwise-unhandled failures so they show up on the dashboard.
export function installProcessHandlers() {
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', 'process', err);
  });
  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    logger.error('Unhandled promise rejection', 'process', err);
  });
}
