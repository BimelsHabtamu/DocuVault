

import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

/** How often to probe the backend while potentially disconnected (ms). */
const PROBE_INTERVAL_MS = 10_000;

/** How long to wait for the health-check fetch before giving up (ms). */
const PROBE_TIMEOUT_MS = 5_000;

export const NetworkContext = createContext(null);

/** Probe the backend health endpoint. Resolves true if reachable. */
async function probeServer() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
      // Bypass any cache so we always hit the network
      cache: 'no-store',
    });
    // 401 means the server IS up (just unauthenticated)
    return res.ok || res.status === 401;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function NetworkProvider({ children }) {
  /**
   * Derive the initial status: if the browser already says we're offline,
   * start there so the banner appears immediately on load.
   */
  const [status, setStatus] = useState(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online'
  );

  const probeTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  // ── helpers ──────────────────────────────────────────────────────────────

  const clearProbe = useCallback(() => {
    if (probeTimerRef.current) {
      clearInterval(probeTimerRef.current);
      probeTimerRef.current = null;
    }
  }, []);

  /**
   * Run a server probe and update state accordingly.
   * Called both immediately on certain events and on each timer tick.
   */
  const runProbe = useCallback(async () => {
    if (!isMountedRef.current) return;
    const reachable = await probeServer();
    if (!isMountedRef.current) return;
    setStatus(reachable ? 'online' : 'server-down');
  }, []);

  /** Start the recurring probe loop. */
  const startProbing = useCallback(() => {
    clearProbe();
    // Run immediately, then on an interval
    runProbe();
    probeTimerRef.current = setInterval(runProbe, PROBE_INTERVAL_MS);
  }, [clearProbe, runProbe]);

  // ── browser network events ────────────────────────────────────────────────

  useEffect(() => {
    isMountedRef.current = true;

    const handleOffline = () => {
      if (!isMountedRef.current) return;
      clearProbe();
      setStatus('offline');
    };

    const handleOnline = () => {
      if (!isMountedRef.current) return;
      // Browser says we're back — but the server might still be down.
      setStatus('reconnecting');
      startProbing();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    // Kick off an initial probe so we detect a "server-down" state on first load.
    startProbing();

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      clearProbe();
    };
  }, [clearProbe, startProbing]);

  // ── public API ────────────────────────────────────────────────────────────

  /** True only when we're confident everything is working. */
  const isOnline = status === 'online';

  /**
   * Components can call this after a failed request to force an immediate
   * re-probe (rather than waiting for the next interval tick).
   */
  const retryNow = useCallback(() => {
    if (!navigator.onLine) {
      setStatus('offline');
      return;
    }
    setStatus('reconnecting');
    startProbing();
  }, [startProbing]);

  /**
   * Marks the status as server-down from outside (e.g. api.js on network error).
   * This keeps the context in sync when a real API call fails, without waiting
   * for the next probe interval.
   */
  const markServerDown = useCallback(() => {
    if (!isMountedRef.current) return;
    if (!navigator.onLine) {
      setStatus('offline');
    } else {
      setStatus('server-down');
      // Also restart the probe so we recover quickly
      startProbing();
    }
  }, [startProbing]);

  return (
    <NetworkContext.Provider value={{ status, isOnline, retryNow, markServerDown }}>
      {children}
    </NetworkContext.Provider>
  );
}
