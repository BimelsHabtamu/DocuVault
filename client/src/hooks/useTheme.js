/**
 * useTheme — shared dark/light mode hook.
 *
 * Reads and writes the same localStorage key that Navbar.jsx has always used
 * ('doc-automation-theme'), so migrating Navbar to this hook is a zero-breaking-
 * change drop-in. Any component can call useTheme() and get the same toggle state;
 * cross-tab/cross-component sync happens via the 'storage' event.
 *
 * No ThemeContext is created — the DOM class is the single source of truth.
 * Every call to useTheme() independently reads from localStorage on mount and
 * listens for changes, keeping all instances in sync without a provider.
 */
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'doc-automation-theme';

function readDark() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark')  return true;
    if (saved === 'light') return false;
  } catch { /* localStorage blocked */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function applyDark(dark) {
  if (dark) document.documentElement.classList.add('dark');
  else      document.documentElement.classList.remove('dark');
  try { localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light'); } catch { /* ignore */ }
}

export function useTheme() {
  const [dark, setDarkState] = useState(readDark);

  // Apply class on mount and whenever dark changes
  useEffect(() => { applyDark(dark); }, [dark]);

  // Sync across components/tabs via the storage event
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        setDarkState(e.newValue === 'dark');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Also follow OS preference changes if the user hasn't pinned a preference
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const handler = (e) => {
      try { if (!localStorage.getItem(STORAGE_KEY)) setDarkState(e.matches); }
      catch { setDarkState(e.matches); }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggle = useCallback(() => {
    setDarkState((d) => {
      const next = !d;
      applyDark(next);
      // Dispatch a storage event so other useTheme() instances in the same tab
      // also update (window.dispatchEvent is needed because the 'storage' event
      // only fires in OTHER tabs by default for same-origin changes).
      try {
        window.dispatchEvent(new StorageEvent('storage', {
          key: STORAGE_KEY,
          newValue: next ? 'dark' : 'light',
          storageArea: localStorage,
        }));
      } catch { /* IE/old browsers that don't support StorageEvent constructor */ }
      return next;
    });
  }, []);

  return { dark, toggle };
}
