import { config } from '../../config/index.js';

/**
 * Cookie options shared by set and clear.
 *
 * The two must match on everything except `maxAge`, or the browser treats them
 * as different cookies and logout silently leaves the session cookie in place.
 *
 * - `httpOnly`: JavaScript cannot read the token, so an XSS bug cannot steal it.
 * - `sameSite: 'lax'`: not sent on cross-site POSTs, which blocks CSRF on every
 *   state-changing endpoint while still allowing normal navigation.
 * - `secure` in production only: a secure cookie is dropped over plain HTTP,
 *   which would break `http://localhost` in development.
 */
const baseCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProduction,
  path: '/',
};

/**
 * Writes the session cookie. Controller-layer helper — it touches `res`.
 *
 * @param {import('express').Response} res
 * @param {string} token
 * @param {Date} expiresAt  Taken from the token itself, so cookie and JWT
 *   always expire together.
 */
export function setAuthCookie(res, token, expiresAt) {
  res.cookie(config.auth.cookieName, token, {
    ...baseCookieOptions,
    maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
  });
}

/**
 * Removes the session cookie.
 *
 * @param {import('express').Response} res
 */
export function clearAuthCookie(res) {
  res.clearCookie(config.auth.cookieName, baseCookieOptions);
}
