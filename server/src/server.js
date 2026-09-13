import { createApp } from './app.js';
import { config } from './config/index.js';
import { closePool } from './db/pool.js';
import { logger } from './utils/logger.js';

const app = createApp();
const server = app.listen(config.server.port, () => {
  logger.info(`API listening on http://localhost:${config.server.port} (${config.env})`);
});

let shuttingDown = false;

/**
 * Stops accepting connections, lets in-flight requests finish, then closes the
 * database pool. Without this, `docker compose down` can kill a request midway
 * through a transaction.
 *
 * @param {string} signal
 */
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received — shutting down`);

  const forceExit = setTimeout(() => {
    logger.error('Shutdown timed out after 10s — forcing exit');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async (error) => {
    if (error) logger.error('Error while closing HTTP server', { message: error.message });
    try {
      await closePool();
    } catch (poolError) {
      logger.error('Error while closing database pool', { message: poolError.message });
    }
    process.exit(error ? 1 : 0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// A promise rejection or exception that escapes every handler leaves the
// process in an unknown state; log it and let the orchestrator restart us.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
  shutdown('unhandledRejection');
});
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { message: error.message, stack: error.stack });
  shutdown('uncaughtException');
});
