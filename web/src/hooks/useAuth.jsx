import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from '../api/auth.js';

/**
 * Session state for the whole app.
 *
 * The token itself is an httpOnly cookie, so it is deliberately invisible to
 * JavaScript — this context tracks only who is signed in. On boot it asks the
 * server, because the cookie may exist, be expired, or belong to a user who has
 * since been deleted, and only the server knows which.
 */
const AuthContext = createContext(null);

/** @typedef {'loading' | 'ready'} AuthStatus */

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(/** @type {AuthStatus} */ ('loading'));

  useEffect(() => {
    let cancelled = false;

    authApi
      .getCurrentUser()
      .then((currentUser) => {
        if (!cancelled) setUser(currentUser);
      })
      .catch(() => {
        // A 401 here is the normal "not signed in" case, not an error worth
        // showing. Anything else (server down) is surfaced by the first real
        // action the user takes.
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setStatus('ready');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    setUser(await authApi.login(credentials));
  }, []);

  const signup = useCallback(async (credentials) => {
    setUser(await authApi.signup(credentials));
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Clear locally even if the request failed: the user asked to sign out,
      // and leaving them looking signed in would be worse than a stale cookie.
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, status, login, signup, logout }),
    [user, status, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * @returns {{ user: import('../api/auth.js').User | null, status: AuthStatus,
 *   login: (c: object) => Promise<void>, signup: (c: object) => Promise<void>,
 *   logout: () => Promise<void> }}
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside an <AuthProvider>');
  }

  return context;
}
