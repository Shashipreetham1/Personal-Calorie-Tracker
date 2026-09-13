import { query } from '../../db/pool.js';

/**
 * Cheapest possible round-trip that proves the pool can reach Postgres.
 *
 * @returns {Promise<boolean>}
 */
export async function pingDatabase() {
  const result = await query('SELECT 1 AS ok');
  return result.rows[0]?.ok === 1;
}
