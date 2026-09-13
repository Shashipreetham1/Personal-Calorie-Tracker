import { request } from './client.js';

/**
 * @typedef {object} User
 * @property {number} id
 * @property {string} email
 * @property {string | null} name
 * @property {string} createdAt
 */

/**
 * Creates an account and starts a session.
 *
 * The session token is set as an httpOnly cookie by the server, so there is
 * nothing to store here — the browser sends it automatically on later requests.
 *
 * @param {{ email: string, password: string, name?: string }} credentials
 * @returns {Promise<User>}
 * @throws {import('./client.js').ApiError} 409 if the email is already registered.
 */
export function signup(credentials) {
  return request('/auth/signup', { method: 'POST', body: credentials });
}

/**
 * Starts a session with existing credentials.
 *
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<User>}
 * @throws {import('./client.js').ApiError} 401 with a message that does not
 *   reveal whether the email exists.
 */
export function login(credentials) {
  return request('/auth/login', { method: 'POST', body: credentials });
}

/**
 * Ends the session. Succeeds even when the token has already expired.
 *
 * @returns {Promise<null>}
 */
export function logout() {
  return request('/auth/logout', { method: 'POST' });
}

/**
 * The user behind the current session.
 *
 * @returns {Promise<User>}
 * @throws {import('./client.js').ApiError} 401 when not signed in.
 */
export function getCurrentUser() {
  return request('/auth/me');
}
