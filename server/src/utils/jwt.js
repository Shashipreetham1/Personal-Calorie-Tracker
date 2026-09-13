import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AppError } from './AppError.js';

/**
 * Signs a session token.
 *
 * The payload carries only the user id and email — never a role, a name, or
 * anything the client could benefit from tampering with, and nothing that goes
 * stale between issue and expiry.
 *
 * @param {{ id: number, email: string }} user
 * @returns {{ token: string, expiresAt: Date }}
 */
export function signAuthToken(user) {
  const token = jwt.sign(
    // `sub` is a registered claim and must be a string per RFC 7519.
    { sub: String(user.id), email: user.email },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn },
  );

  const { exp } = jwt.decode(token);

  return { token, expiresAt: new Date(exp * 1000) };
}

/**
 * Verifies a session token and returns its subject.
 *
 * @param {string} token
 * @returns {{ id: number, email: string }}
 * @throws {AppError} 401 for an expired, malformed, or forged token.
 */
export function verifyAuthToken(token) {
  let payload;

  try {
    payload = jwt.verify(token, config.auth.jwtSecret);
  } catch (error) {
    // Expiry is worth distinguishing: the client should prompt a fresh login
    // rather than report a generic failure. Anything else is just invalid.
    throw error.name === 'TokenExpiredError'
      ? AppError.unauthorized('Your session has expired. Please log in again.')
      : AppError.unauthorized('Invalid session. Please log in again.');
  }

  const id = Number(payload.sub);
  if (!Number.isInteger(id) || id <= 0) {
    throw AppError.unauthorized('Invalid session. Please log in again.');
  }

  return { id, email: payload.email };
}
