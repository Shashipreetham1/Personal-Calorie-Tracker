import { request } from './client.js';

/**
 * Fetches API and database status.
 *
 * @returns {Promise<{ status: 'ok' | 'degraded', db: 'connected' | 'disconnected' }>}
 */
export function getHealth() {
  return request('/health');
}
