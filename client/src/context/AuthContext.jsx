import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import i18n from '../i18n';
import { resolveAndApplyPreferences } from './ThemeContext.jsx';

const AuthContext = createContext(null);

/**
 * Apply a user's stored language + theme preferences immediately.
 * Called both on initial load (from localStorage) and after login.
 */
function applyUserPreferences(userData) {
  if (!userData) return;
  if (userData.language) {
    i18n.changeLanguage(userData.language);
  }
  if (userData.theme) {
    resolveAndApplyPreferences(userData.theme);
  }
}

export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null);
  const [token,       setToken]       = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // On first load: verify the stored token with the server before trusting it.
  // This prevents a stale/expired token in localStorage from auto-redirecting
  // the user to /dashboard when they click "Sign In" on the landing page.
  useEffect(() => {
    const savedToken = localStorage.getItem('token');

    if (!savedToken) {
      // No token at all — nothing to verify
      setAuthLoading(false);
      return;
    }

    // Track whether this effect invocation is still "current".
    // React StrictMode mounts → unmounts → remounts in development,
    // so this flag prevents the first (stale) invocation from updating state
    // after the second invocation has already started.
    let cancelled = false;

    // 10-second timeout guard: if the server doesn't respond, unblock the UI
    // instead of leaving authLoading=true permanently (blank page).
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 10000);

    axios
      .get('/api/auth/me', {
        headers: { Authorization: `Bearer ${savedToken}` },
        signal:  controller.signal,
      })
      .then((res) => {
        if (cancelled) return;
        // Token valid — restore session from server response (always fresh)
        const freshUser = res.data.user ?? res.data;
        localStorage.setItem('user', JSON.stringify(freshUser));
        setToken(savedToken);
        setUser(freshUser);
        applyUserPreferences(freshUser);
      })
      .catch((err) => {
        if (cancelled) return;
        // Timeout or network error — leave localStorage intact so user stays logged in
        // on next load (don't wipe a valid token just because the server was slow).
        // Only clear if the server explicitly returned 401/403 (invalid/expired token).
        const status = err.response?.status;
        if (status === 401 || status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
        // For network errors, aborts, or timeouts: keep the stored token as-is
        // so the next page load (when server is back) will log the user in correctly.
        // We still fall through to setAuthLoading(false) below.
      })
      .finally(() => {
        clearTimeout(timeoutId);
        if (!cancelled) {
          setAuthLoading(false);
        }
      });

    return () => {
      // Cleanup: mark this effect invocation as stale so its callbacks don't fire.
      // Also abort the in-flight HTTP request to avoid a memory leak.
      cancelled = true;
      controller.abort();
      // IMPORTANT: Also resolve authLoading here in case the cleanup runs
      // before the request completes (StrictMode double-invoke scenario).
      // The second effect invocation will manage authLoading independently.
    };
  }, []);

  const login = (userData, jwtToken) => {
    localStorage.setItem('token', jwtToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(jwtToken);
    setUser(userData);
    // Sync language + theme from the server-side user record
    applyUserPreferences(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const updateUser = (userData) => {
    const nextUser = { ...user, ...userData };
    localStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, isAuthenticated: !!token, authLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
