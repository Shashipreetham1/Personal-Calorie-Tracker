import { config } from '../config/index.js';

/**
 * Minimal structured logger.
 *
 * Deliberately not a logging library: the app has one process and one sink.
 * Keeping it behind this module means swapping in pino later touches one file.
 */
function emit(level, message, meta) {
  if (config.isTest && level !== 'error') return;

  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
  const target = level === 'error' ? console.error : console.log;

  if (meta === undefined) target(line);
  else target(line, meta);
}

export const logger = {
  info: (message, meta) => emit('info', message, meta),
  warn: (message, meta) => emit('warn', message, meta),
  error: (message, meta) => emit('error', message, meta),
  debug: (message, meta) => {
    if (!config.isProduction) emit('debug', message, meta);
  },
};
