import * as healthService from './health.service.js';

/**
 * GET /api/health
 *
 * 200 `{ status: 'ok', db: 'connected' }` when the database answers,
 * 503 with `db: 'disconnected'` when it does not, so orchestrators can act on it.
 *
 * @type {import('express').RequestHandler}
 */
export async function getHealth(req, res) {
  const health = await healthService.getHealth();
  res.status(health.status === 'ok' ? 200 : 503).json(health);
}
