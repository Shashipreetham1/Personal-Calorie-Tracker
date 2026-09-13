import { query } from '../../db/pool.js';

/**
 * Maps a users row to the shape the API exposes.
 *
 * Columns are listed explicitly rather than spread, which is what guarantees
 * `password_hash` can never leak into a response by accident.
 *
 * @param {Record<string, unknown>} row
 * @returns {{ id: number, email: string, name: string | null, createdAt: Date }}
 */
function toPublicUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at,
  };
}

/**
 * Inserts a new user.
 *
 * @param {{ email: string, passwordHash: string, name?: string }} input
 * @param {{ query: Function }} [client]  Optional transaction client.
 * @returns {Promise<{ id: number, email: string, name: string | null, createdAt: Date }>}
 * @throws Postgres error 23505 if the email is already registered.
 */
export async function insertUser({ email, passwordHash, name }, client) {
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, email, name, created_at`,
    [email, passwordHash, name ?? null],
    client,
  );

  return toPublicUser(rows[0]);
}

/**
 * Finds a user by email, including the password hash.
 *
 * The only function that returns the hash — it exists solely for login, which
 * is why it is named for that rather than being a general `findByEmail`.
 *
 * @param {string} email  Already lowercased by the schema.
 * @returns {Promise<{ id: number, email: string, name: string | null, createdAt: Date, passwordHash: string } | null>}
 */
export async function findByEmailWithHash(email) {
  const { rows } = await query(
    `SELECT id, email, name, created_at, password_hash
       FROM users
      WHERE email = $1`,
    [email],
  );

  if (rows.length === 0) return null;
  return { ...toPublicUser(rows[0]), passwordHash: rows[0].password_hash };
}

/**
 * Finds a user by id. Used by `GET /me` to confirm the JWT's subject still exists.
 *
 * @param {number} userId
 * @returns {Promise<{ id: number, email: string, name: string | null, createdAt: Date } | null>}
 */
export async function findById(userId) {
  const { rows } = await query(
    `SELECT id, email, name, created_at
       FROM users
      WHERE id = $1`,
    [userId],
  );

  return rows.length === 0 ? null : toPublicUser(rows[0]);
}
