import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { verifyAuthToken } from '../utils/jwt.js';

/**
 * Rejects unauthenticated requests and attaches `req.user = { id, email }`.
 *
 * Every user-scoped route sits behind this, and `req.user.id` is the ONLY
 * source of a user id anywhere in the API — never the body, query, or params.
 * That single rule is what makes cross-user data access structurally
 * impossible rather than something each handler has to remember.
 *
 * The token is verified but the user row is not loaded on every request; a
 * deleted account keeps a valid token until expiry (at most JWT_EXPIRES_IN).
 * `GET /me` does hit the database, so the client learns quickly.
 *
 * @type {import('express').RequestHandler}
 */
export function requireAuth(req, _res, next) {
  const token = req.cookies?.[config.auth.cookieName];

  if (!token) {
    return next(AppError.unauthorized('Authentication required'));
  }

  try {
    req.user = verifyAuthToken(token);
  } catch (error) {
    return next(error);
  }

  return next();
}
