import { createContext, useEffect, useState, useCallback } from 'react';
import { CONNECTION_RESTORED_EVENT } from './NetworkContext';
import {
  login as loginRequest,
  logout as logoutRequest,
  fetchCurrentUser,
  restoreTokenFromStorage,
  saveUserToCache,
  loadUserFromCache,
  verifyOfflineCredentials,
} from '../services/authService';
import { setCacheNamespace } from '../services/offlineCache';
import { warmCacheForRole, refreshCacheForRole } from '../services/cacheWarmingService';

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

  // ── Per-user offline cache namespace ─────────────────────────────────────

  /**
   * Every cached API response is stored under the signed-in user's id, and the
   * previous namespace is dropped on switch. Without this, two people sharing a
   * machine could read each other's cached documents while offline.
   *
   * Deliberately does nothing while `user` is null: on a fresh page load we have
   * not identified the user yet, and defaulting to 'anon' would wipe the offline
   * cache of a session-only user every time they reopen the tab — before they
   * have had the chance to sign back in. Signing out wipes the cache explicitly
   * (authService.logout), and signing in as someone else replaces the namespace.
   */
  useEffect(() => {
    if (!user?.id) return;
    setCacheNamespace(user.id);
  }, [user?.id]);

  // ── Session restoration on app load ──────────────────────────────────────

  useEffect(() => {
    (async () => {
      const token = restoreTokenFromStorage();
      if (!token) {
        setIsLoading(false);
        return;
      }

      // Always try the server — no navigator.onLine gating.
      try {
        const currentUser = await fetchCurrentUser();
        setUser(currentUser);
        setIsOfflineSession(false);
        void warmCacheForRole(currentUser.role);
      } catch (err) {
        // Token expired / invalid (401, 403) — clear silently, force re-login.
        // For any other error (server temporarily down) fall back to cache.
        const cachedUser = loadUserFromCache();
        if (cachedUser && err?.isOfflineError) {
          setUser(cachedUser);
          setIsOfflineSession(true);
        } else {
          setUser(null);
          setIsOfflineSession(false);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ── When connection is restored, silently re-validate if on offline session ─

  useEffect(() => {
    if (!isOfflineSession) return;

    const handleReconnect = async () => {
      try {
        const currentUser = await fetchCurrentUser();
        setUser(currentUser);
        setIsOfflineSession(false);
        // Refresh all cached data now that the connection is back.
        // No delay — we want fresh data ASAP after coming back online.
        void refreshCacheForRole(currentUser.role);
      } catch {
        // Token might have expired while offline; don't force logout automatically.
        // The next server action they attempt will surface the error.
      }
    };

    // 'online' covers losing Wi-Fi; the custom event covers the server coming
    // back up while the device itself never went offline (deploys, restarts).
    window.addEventListener('online', handleReconnect);
    window.addEventListener(CONNECTION_RESTORED_EVENT, handleReconnect);
    return () => {
      window.removeEventListener('online', handleReconnect);
      window.removeEventListener(CONNECTION_RESTORED_EVENT, handleReconnect);
    };
  }, [isOfflineSession]);

  // ── Auth actions ──────────────────────────────────────────────────────────

  const login = useCallback(async (email, password, rememberMe = false) => {
    setError(null);
    try {
      const loggedInUser = await loginRequest(email, password, rememberMe);
      setUser(loggedInUser);
      setIsOfflineSession(false);
      // Eagerly cache all key pages in the background so the app is immediately
      // usable offline — even if the user never visits those pages before going offline.
      void warmCacheForRole(loggedInUser.role);
      return loggedInUser;
    } catch (err) {
      setError(err.message || 'Login failed.');
      throw err;
    }
  }, []);

  /**
   * offlineLogin — authenticate using the locally-cached credential hash.
   *
   * Called by LoginPage when the device is offline (or server is unreachable)
   * and the user submits the login form. If the entered credentials match the
   * stored hash AND a cached user profile exists, we restore the session exactly
   * as the startup path does — setting isOfflineSession=true so that the rest
   * of the app knows server mutations are unavailable.
   *
   * Returns the cached user on success, throws on failure (wrong credentials,
   * no cached profile, hash unavailable).
   */
  const offlineLogin = useCallback(async (email, password) => {
    const cachedUser = loadUserFromCache();
    if (!cachedUser) {
      throw new Error(
        'No offline profile found. Please connect to the internet and sign in once first.'
      );
    }

    const valid = await verifyOfflineCredentials(email, password);
    if (!valid) {
      throw new Error('Incorrect email or password.');
    }

    setUser(cachedUser);
    setIsOfflineSession(true);
    return cachedUser;
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
        offlineLogin,
        logout,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
