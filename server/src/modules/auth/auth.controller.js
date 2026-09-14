import * as authService from './auth.service.js';
import { setAuthCookie, clearAuthCookie } from './auth.cookie.js';

/**
 * POST /api/auth/signup → 201 with the new user; session cookie set.
 */
export async function signup(req, res) {
  const { user, token, expiresAt } = await authService.signup(req.validated.body);

  setAuthCookie(res, token, expiresAt);
  res.status(201).json(user);
}

/**
 * POST /api/auth/login → 200 with the user; session cookie set.
 */
export async function login(req, res) {
  const { user, token, expiresAt } = await authService.login(req.validated.body);

  setAuthCookie(res, token, expiresAt);
  res.status(200).json(user);
}

/**
 * POST /api/auth/logout → 204; session cookie cleared.
 *
 * Deliberately not behind `requireAuth`: a user with an expired token must
 * still be able to log out cleanly rather than be told they are not logged in.
 */
export async function logout(_req, res) {
  clearAuthCookie(res);
  res.status(204).end();
}

/**
 * GET /api/auth/me → 200 with the authenticated user.
 */
export async function me(req, res) {
  const user = await authService.getAuthenticatedUser(req.user.id);
  res.status(200).json(user);
}
