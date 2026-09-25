import { createContext, useEffect, useState, useCallback } from 'react';
import {
  login as loginRequest,
  logout as logoutRequest,
  fetchCurrentUser,
  restoreTokenFromStorage,
  saveUserToCache,
  loadUserFromCache,
} from '../services/authService';

export const AuthContext = createContext(null);

/**
 * AuthProvider — manages authentication state with hybrid offline support.
 *
 * Startup strategy:
 *  1. Check for a stored token (sessionStorage / localStorage).
 *  2. If online  → call /auth/me to validate the token and get a fresh profile.
 *  3. If offline → restore from the locally cached user profile (no server call).
 *     The app opens in read-only / view-only mode; no server operations are allowed.
 *  4. If there is a token but no cache entry and we're offline → treat as unauthenticated
 *     (edge case: token stored but never successfully logged in on this device).
 *
 * On reconnect, a background re-validation call refreshes the cached profile.
 *
 * Security guarantees:
 *  - No credentials are ever stored or read from storage.
 *  - The cached profile is ONLY used to render the UI; all server operations
 *    still require a live network + valid JWT (enforced via the NetworkContext guard).
 *  - Explicit logout always clears both the token and the cache.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  /**
   * isOfflineSession — true when the current user state was restored from the
   * local cache because the server was unreachable at startup.  This flag is
   * consumed by useOfflineGuard / ConnectionBanner to show the right UX.
   */
  const [isOfflineSession, setIsOfflineSession] = useState(false);
  const [error, setError] = useState(null);

  // ── Session restoration on app load ──────────────────────────────────────

  useEffect(() => {
    (async () => {
      const token = restoreTokenFromStorage();
      if (!token) {
        // No token → user has never authenticated on this device
        setIsLoading(false);
        return;
      }

      const isNetworkAvailable = navigator.onLine;

      if (!isNetworkAvailable) {
        // Offline path: try to restore from the local user cache
        const cachedUser = loadUserFromCache();
        if (cachedUser) {
          // Previously authenticated on this device — allow offline session
          setUser(cachedUser);
          setIsOfflineSession(true);
        } else {
          // Token exists but no cached profile → never fully authenticated
          // on this device; require online login.
          setUser(null);
          setIsOfflineSession(false);
        }
        setIsLoading(false);
        return;
      }

      // Online path: validate token + get a fresh profile from the server
      try {
        const currentUser = await fetchCurrentUser();
        setUser(currentUser);
        setIsOfflineSession(false);
      } catch {
        // Token expired / invalid — clear silently, force re-login
        setUser(null);
        setIsOfflineSession(false);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ── When connection is restored, silently re-validate if on offline session ─

  useEffect(() => {
    if (!isOfflineSession) return;

    const handleOnline = async () => {
      try {
        const currentUser = await fetchCurrentUser();
        setUser(currentUser);
        setIsOfflineSession(false);
      } catch {
        // Token might have expired while offline; don't force logout automatically.
        // The next server action they attempt will surface the error.
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isOfflineSession]);

  // ── Auth actions ──────────────────────────────────────────────────────────

  const login = useCallback(async (email, password, rememberMe = false) => {
    setError(null);
    try {
      const loggedInUser = await loginRequest(email, password, rememberMe);
      setUser(loggedInUser);
      setIsOfflineSession(false);
      return loggedInUser;
    } catch (err) {
      setError(err.message || 'Login failed.');
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setIsOfflineSession(false);
  }, []);

  /** Merge partial fields (e.g. a fresh avatar_url or full_name) into the current
   *  user without a full re-login — used right after a profile-photo upload or a
   *  self-service profile edit so the sidebar reflects it instantly. */
  const updateUser = useCallback((partial) => {
    setUser((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...partial };
      // Keep the offline cache in sync
      saveUserToCache(merged);
      return merged;
    });
  }, []);

  /** Re-pulls /auth/me — used when we want the full, DB-fresh record rather than
   *  just patching in the fields a given response happened to return. */
  const refreshUser = useCallback(async () => {
    const currentUser = await fetchCurrentUser();
    setUser(currentUser);
    setIsOfflineSession(false);
    return currentUser;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        isOfflineSession,
        login,
        logout,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
