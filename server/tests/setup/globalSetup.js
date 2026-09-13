import pg from 'pg';
import { TEST_DATABASE_URL } from './testDatabase.js';

/**
 * Creates the test database if it does not exist, then migrates it.
 *
 * Running once per test run rather than per file keeps the suite fast, and
 * means a developer never has to remember a setup command: `npm test` on a
 * clean machine with the compose stack up just works.
 */
export async function setup() {
  // globalSetup runs before the worker environment exists, so it reads the URL
  // from the shared module rather than process.env, and then sets it for the
  // migration runner it is about to import.
  const databaseUrl = TEST_DATABASE_URL;
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET ??= 'test-only-secret-that-is-long-enough-32';

  const databaseName = new URL(databaseUrl).pathname.slice(1);

  // Connect to the maintenance database to create ours — you cannot CREATE
  // DATABASE from inside the database being created.
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = '/postgres';

  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();

  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
    databaseName,
  ]);

  if (rowCount === 0) {
    // Identifiers cannot be parameterised; the name comes from our own config,
    // never from user input, and is quoted defensively all the same.
    await admin.query(`CREATE DATABASE "${databaseName.replace(/"/g, '""')}"`);
  }

  await admin.end();

  // Imported lazily: the migration runner reads config at import time, which
  // must happen after DATABASE_URL is pointed at the test database.
  const { runMigrations } = await import('../../src/db/migrate.js');
  const { closePool } = await import('../../src/db/pool.js');

  await runMigrations();
  await closePool();
}
