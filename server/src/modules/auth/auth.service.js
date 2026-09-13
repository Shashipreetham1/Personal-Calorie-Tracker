import bcrypt from 'bcrypt';
import * as authRepository from './auth.repository.js';
import { AppError } from '../../utils/AppError.js';
import { signAuthToken } from '../../utils/jwt.js';

const BCRYPT_ROUNDS = 10;

/**
 * A valid bcrypt hash of a value nobody can supply.
 *
 * When an unknown email is submitted there is no stored hash to compare
 * against, so a naive implementation returns immediately while a real account
 * spends ~80ms hashing. That difference is measurable and turns the login
 * endpoint into an account-enumeration oracle. Comparing against this hash
 * costs the same as a real check.
 */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('unused-placeholder-password', BCRYPT_ROUNDS);

/** Identical for a wrong password and an unknown email — never say which. */
const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

/**
 * Registers a new account and issues a session token.
 *
 * @param {{ email: string, password: string, name?: string }} input
 * @returns {Promise<{ user: { id: number, email: string, name: string | null, createdAt: Date }, token: string, expiresAt: Date }>}
 * @throws {AppError} 409 if the email is already registered.
 */
export async function signup({ email, password, name }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let user;
  try {
    user = await authRepository.insertUser({ email, passwordHash, name });
  } catch (error) {
    // Relying on the UNIQUE constraint rather than a prior SELECT: checking
    // first leaves a window where two concurrent signups both pass the check.
    if (error.code === '23505') {
      throw AppError.conflict('An account with that email already exists');
    }
    throw error;
  }

  return { user, ...signAuthToken(user) };
}

/**
 * Verifies credentials and issues a session token.
 *
 * @param {{ email: string, password: string }} input
 * @returns {Promise<{ user: { id: number, email: string, name: string | null, createdAt: Date }, token: string, expiresAt: Date }>}
 * @throws {AppError} 401 with a message that does not reveal whether the email exists.
 */
export async function login({ email, password }) {
  const record = await authRepository.findByEmailWithHash(email);

  const passwordMatches = await bcrypt.compare(password, record?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!record || !passwordMatches) {
    throw AppError.unauthorized(INVALID_CREDENTIALS_MESSAGE);
  }

  const user = { id: record.id, email: record.email, name: record.name, createdAt: record.createdAt };

  return { user, ...signAuthToken(user) };
}

/**
 * Loads the account behind a session.
 *
 * A token can outlive its user (deleted account), so this is a real lookup
 * rather than a read of the JWT payload.
 *
 * @param {number} userId
 * @returns {Promise<{ id: number, email: string, name: string | null, createdAt: Date }>}
 * @throws {AppError} 401 if the account no longer exists.
 */
export async function getAuthenticatedUser(userId) {
  const user = await authRepository.findById(userId);
  if (!user) throw AppError.unauthorized('Your account no longer exists');

  return user;
}
