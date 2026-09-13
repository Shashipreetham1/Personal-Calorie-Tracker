/**
 * The test database URL, in one place.
 *
 * Both `vitest.config.js` (which injects it into the worker environment) and
 * `globalSetup.js` (which runs before that environment exists) need this, and
 * a second copy would drift.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://calorie:calorie@localhost:5432/calorie_tracker_test';
