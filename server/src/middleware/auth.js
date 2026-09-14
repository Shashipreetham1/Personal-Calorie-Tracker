import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { verifyAuthToken } from '../utils/jwt.js';

/**
 * Rejects unauthenticated requests and attaches `req.user = { id, email }`.
 *
 * `req.user.id` is the ONLY source of a user id in the API — never the body,
 * query or params. That one rule is what makes cross-user access structurally
 * impossible rather than something each handler must remember.
 *
 * The row is not loaded per request, so a deleted account keeps a valid token
 * until it expires; `GET /me` does hit the database.
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
