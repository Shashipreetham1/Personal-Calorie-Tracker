import { config } from '../../config/index.js';

/**
 * Cookie options shared by set and clear — they must match on everything but
 * `maxAge`, or the browser treats them as different cookies and logout leaves
 * the session in place.
 *
 * `httpOnly` keeps the token away from XSS; `sameSite: 'lax'` blocks CSRF on
 * state-changing requests; `secure` is production-only so localhost still works.
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
