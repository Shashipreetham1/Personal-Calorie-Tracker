import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './tests/setup/testDatabase.js';

/**
 * Tests run against a real Postgres database, not a mock.
 *
 * Most of what is worth testing here IS the SQL — gap-filled date series, a
 * LATERAL join picking the right dated goal, JSONB aggregation. Mocking the
 * database would test the mock and leave every one of those untested.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/setup/globalSetup.js'],
    // One shared database, so files must not run concurrently against it.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      // A database of its own: tests truncate freely, and running them can
      // never wipe the data you were looking at in the app.
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'test-only-secret-that-is-long-enough-32',
      GEMINI_API_KEY: '',
    },
  },
});
