import * as healthRepository from './health.repository.js';
import { logger } from '../../utils/logger.js';

/**
 * Reports whether the API and its database are usable.
 *
 * A failed ping is reported, not thrown: the caller needs the degraded status
 * to answer with, and an unreachable database is not an unexpected error here.
 *
 * @returns {Promise<{ status: 'ok' | 'degraded', db: 'connected' | 'disconnected' }>}
 */
export async function getHealth() {
  try {
    const reachable = await healthRepository.pingDatabase();
    return reachable
      ? { status: 'ok', db: 'connected' }
      : { status: 'degraded', db: 'disconnected' };
  } catch (error) {
    logger.error('Health check could not reach the database', { message: error.message });
    return { status: 'degraded', db: 'disconnected' };
  }
}
