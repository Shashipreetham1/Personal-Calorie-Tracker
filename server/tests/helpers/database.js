import { query, closePool } from '../../src/db/pool.js';
import * as authService from '../../src/modules/auth/auth.service.js';

/**
 * Empties every table.
 *
 * TRUNCATE ... CASCADE rather than DELETE: it resets the identity sequences
 * too, so ids are predictable from test to test, and it is far faster.
 */
export async function resetDatabase() {
  await query('TRUNCATE users, goals, food_entries, chat_messages, extractions RESTART IDENTITY CASCADE');
}

/**
 * Creates a user through the real signup path, so the row is exactly what the
 * application would have produced.
 *
 * @param {string} [label]  Makes the address unique and the failure readable.
 * @returns {Promise<{ id: number, email: string }>}
 */
export async function createTestUser(label = 'user') {
  const { user } = await authService.signup({
    email: `${label}-${Math.random().toString(36).slice(2, 8)}@example.test`,
    password: 'correct-horse-battery',
    name: label,
  });

  return user;
}

/** Closes the pool so the test process can exit. */
export async function closeDatabase() {
  await closePool();
}
