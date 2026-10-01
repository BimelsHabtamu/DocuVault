/**
 * serviceWorker.js — registers the offline app-shell worker.
 *
 * Registration is deliberately limited to production builds:
 *   • Service workers are unavailable on plain-HTTP origins other than localhost,
 *     and the LAN-access dev workflow (http://<ip>:5173) relies on live reloads.
 *   • In dev, a cached shell would serve stale modules and break HMR.
 *
 * The worker precaches the SPA shell and hashed assets, which is what makes a
 * cold page load work with no connectivity. API data is cached separately, per
 * user, in IndexedDB (offlineCache.js) — never in the worker's HTTP cache.
 */

export function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      if (import.meta.env.DEV) {
        console.warn('[sw] Registration failed:', err);
      }
      // Offline shell is unavailable, but the app itself still works online.
    });
  });
}

/**
 * Ask the worker to drop everything it holds. Used on sign-out so the next
 * person to sign in on a shared machine cannot load the previous user's shell
 * state from the HTTP cache.
 */
export async function clearServiceWorkerCaches() {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration('/');
    const worker = registration?.active;
    if (!worker) return;
    worker.postMessage({ type: 'CLEAR_CACHES' });
  } catch {
    /* best-effort */
  }
}
