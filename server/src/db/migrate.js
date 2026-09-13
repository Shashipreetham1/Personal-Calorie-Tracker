import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pool, closePool } from './pool.js';
import { logger } from '../utils/logger.js';

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

/**
 * Session-level advisory lock held for the duration of the run.
 *
 * `docker compose up` can start more than one API process against one database;
 * without this they would race to apply the same migration and one would fail
 * on a duplicate object. The second process simply waits, then finds nothing
 * left to do.
 */
const MIGRATION_LOCK_ID = 4207331;

/**
 * Waits for Postgres to accept connections.
 *
 * Compose gates the backend on a healthcheck, but running `npm run migrate`
 * directly against a container that is still starting is common enough to be
 * worth retrying rather than failing.
 *
 * @param {{ retries?: number, delayMs?: number }} [options]
 */
async function waitForDatabase({ retries = 10, delayMs = 1000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const client = await pool.connect();
      client.release();
      return;
    } catch (error) {
      if (attempt === retries) {
        throw new Error(`Database unreachable after ${retries} attempts: ${error.message}`);
      }
      logger.info(`Database not ready (attempt ${attempt}/${retries}), retrying in ${delayMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Creates the ledger of applied migrations. Idempotent, and the only piece of
 * schema not itself managed by a migration file.
 *
 * @param {import('pg').PoolClient} client
 */
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      checksum   text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

/**
 * Reads migration files from disk in lexical order — which is why they are
 * numbered: 010_x.sql must not run before 002_y.sql.
 *
 * @returns {Promise<{ name: string, sql: string, checksum: string }[]>}
 */
async function readMigrationFiles() {
  const filenames = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

  return Promise.all(
    filenames.map(async (name) => {
      const sql = await readFile(path.join(MIGRATIONS_DIR, name), 'utf8');
      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    }),
  );
}

/**
 * Applies every migration that has not run yet.
 *
 * Each migration runs inside its own transaction, so a failure halfway through
 * a file leaves no half-created schema and no ledger entry — fix the SQL and
 * re-run. Already-applied files are checksummed: editing one after it has run
 * is a mistake (it would silently diverge from what the database contains), and
 * is reported rather than ignored.
 *
 * @returns {Promise<{ applied: string[], skipped: number }>}
 */
export async function runMigrations() {
  await waitForDatabase();

  const migrations = await readMigrationFiles();
  const client = await pool.connect();
  const applied = [];

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await ensureMigrationsTable(client);

    const { rows } = await client.query('SELECT name, checksum FROM schema_migrations');
    const alreadyApplied = new Map(rows.map((row) => [row.name, row.checksum]));

    for (const migration of migrations) {
      const previousChecksum = alreadyApplied.get(migration.name);

      if (previousChecksum !== undefined) {
        if (previousChecksum !== migration.checksum) {
          throw new Error(
            `Migration ${migration.name} was modified after being applied. ` +
              'Migrations are immutable — add a new numbered file instead.',
          );
        }
        continue;
      }

      logger.info(`Applying migration ${migration.name}`);
      try {
        await client.query('BEGIN');
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [
          migration.name,
          migration.checksum,
        ]);
        await client.query('COMMIT');
        applied.push(migration.name);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${migration.name} failed: ${error.message}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => {});
    client.release();
  }

  const skipped = migrations.length - applied.length;
  logger.info(
    applied.length > 0
      ? `Migrations complete: ${applied.length} applied, ${skipped} already up to date`
      : `Migrations complete: schema already up to date (${skipped} files)`,
  );

  return { applied, skipped };
}

/**
 * Prints which migration files have been applied and which are pending.
 *
 * @returns {Promise<void>}
 */
export async function printMigrationStatus() {
  await waitForDatabase();

  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const { rows } = await client.query(
      'SELECT name, applied_at FROM schema_migrations ORDER BY name',
    );
    const appliedAt = new Map(rows.map((row) => [row.name, row.applied_at]));

    for (const migration of await readMigrationFiles()) {
      const at = appliedAt.get(migration.name);
      logger.info(`${at ? 'applied' : 'PENDING'}  ${migration.name}  ${at?.toISOString() ?? ''}`);
    }
  } finally {
    client.release();
  }
}

// CLI entry point: `npm run migrate` / `npm run migrate:status`. Guarded so
// tests can import runMigrations without the process exiting underneath them.
const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const task = process.argv.includes('--status') ? printMigrationStatus : runMigrations;

  task()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch(async (error) => {
      logger.error(error.message);
      await closePool().catch(() => {});
      process.exit(1);
    });
}
