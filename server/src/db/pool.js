import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const { Pool, types } = pg;

/**
 * node-postgres returns NUMERIC and BIGINT as strings, because both can exceed
 * JavaScript's safe integer range. Every numeric in this schema is a nutrition
 * value or a COUNT, all far inside that range, so parsing them here means
 * services and JSON responses deal in numbers instead of "12.5" strings.
 */
types.setTypeParser(types.builtins.NUMERIC, (value) => (value === null ? null : parseFloat(value)));
types.setTypeParser(types.builtins.INT8, (value) => (value === null ? null : parseInt(value, 10)));

/**
 * DATE columns stay strings.
 *
 * node-postgres otherwise turns `date` into a JS Date at LOCAL midnight, so at
 * UTC+5:30 a goal dated 2026-09-13 serialises as "2026-09-12T18:30:00.000Z" —
 * a day earlier than the user chose. A calendar date has no time and no zone;
 * "YYYY-MM-DD" end to end is the only representation that cannot drift.
 * (`timestamptz` columns like `consumed_at` are real instants and keep Dates.)
 */
types.setTypeParser(types.builtins.DATE, (value) => value);

export const pool = new Pool({
  connectionString: config.db.connectionString,
  max: config.db.poolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// An idle client erroring (e.g. the database restarted) must not take the
// process down; the pool discards it and the next query gets a fresh one.
pool.on('error', (error) => {
  logger.error('Unexpected error on idle database client', { message: error.message });
});

/**
 * Runs a parameterised query. The only way the application talks to Postgres.
 *
 * @param {string} text  SQL with $1-style placeholders. Never interpolate values.
 * @param {unknown[]} [params]
 * @param {{ query: Function }} [executor]  A transaction client from
 *   `withTransaction`. Defaults to the pool, which runs the statement on its
 *   own connection — so a repository function is transactional only when a
 *   caller hands it one, and identical in both cases otherwise.
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function query(text, params = [], executor = pool) {
  const startedAt = Date.now();
  const result = await executor.query(text, params);
  const durationMs = Date.now() - startedAt;

  if (durationMs > 200) {
    logger.warn('Slow query', { durationMs, sql: text.replace(/\s+/g, ' ').trim().slice(0, 120) });
  }

  return result;
}

/**
 * Runs `fn` inside a transaction, committing on success and rolling back on
 * throw. Used by multi-row writes such as the PDF bulk import.
 *
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Closes the pool. Called on shutdown so in-flight queries finish first. */
export async function closePool() {
  await pool.end();
  logger.info('Database pool closed');
}
