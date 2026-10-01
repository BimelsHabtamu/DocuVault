/* eslint-env serviceworker */
/**
 * sw.js — DocuVault offline app-shell service worker.
 *
 * RESPONSIBILITIES (and only these)
 * ──────────────────────────────────
 *  1. Serve the SPA shell (index.html) from cache when the network is gone, so
 *     hard refreshes and direct URL entry still work offline.
 *  2. Cache-first for immutable static assets (Vite's hashed /assets/* bundles
 *     and everything in /public).
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * ────────────────────────────────
 *  It never touches /api/*. API responses are per-user and carry an
 *  Authorization header; a shared HTTP cache keyed by URL would happily hand one
 *  account another account's documents. They are cached per-user in IndexedDB
 *  instead (see src/services/offlineCache.js).
 *
 * Bump CACHE_VERSION to evict everything from a previous deploy.
 */

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `docuvault-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `docuvault-assets-${CACHE_VERSION}`;
const CURRENT_CACHES = new Set([SHELL_CACHE, ASSET_CACHE]);

/** The SPA entry document. Kept under a fixed key so any route can fall back. */
const SHELL_URL = '/index.html';

const PRECACHE_URLS = [SHELL_URL, '/logo.png'];

const OFFLINE_FALLBACK_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DocuVault — Offline</title>
    <style>
      body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
             margin: 0; min-height: 100vh; display: grid; place-items: center;
             background: #0f172a; color: #e2e8f0; text-align: center; padding: 24px; }
      .card { max-width: 420px; }
      h1 { font-size: 1.35rem; margin: 0 0 8px; }
      p { line-height: 1.55; color: #94a3b8; font-size: 0.92rem; }
      button { margin-top: 18px; padding: 10px 20px; border-radius: 8px; border: 0;
               background: #0ea5e9; color: #04121f; font-weight: 600; cursor: pointer; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>You are offline</h1>
      <p>DocuVault has not finished setting up offline access on this device yet.
         Reconnect once and the app will be available offline afterwards.</p>
      <button onclick="location.reload()">Retry</button>
    </div>
  </body>
</html>`;

const ASSET_PATTERN = /\.(?:js|mjs|css|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|eot|map)$/i;

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Add individually: one bad URL must not abort the whole precache.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const response = await fetch(new Request(url, { cache: 'reload' }));
            if (response && response.ok) await cache.put(url, response);
          } catch {
            /* skip — a later runtime fetch may still pick it up */
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('docuvault-') && !CURRENT_CACHES.has(name))
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) return;

  // API data is per-user and auth-headered — it never enters an HTTP cache here.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstShell(request));
    return;
  }

  if (url.pathname.startsWith('/assets/') || ASSET_PATTERN.test(url.pathname)) {
    event.respondWith(cacheFirstAsset(event, request));
  }
});

/**
 * Navigations: try the network (so users get fresh deploys immediately), and on
 * failure hand back the cached shell so client-side routing still boots.
 */
async function networkFirstShell(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(SHELL_URL, response.clone());
    }
    return response;
  } catch {
    const cached = (await cache.match(SHELL_URL)) || (await cache.match(request));
    if (cached) return cached;
    return new Response(OFFLINE_FALLBACK_HTML, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

/**
 * Static assets are content-hashed by Vite, so a cache hit is always correct.
 * Still revalidate in the background so a new deploy is picked up on the next
 * navigation.
 */
async function cacheFirstAsset(event, request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);

  const refresh = fetch(request)
    .then((response) => {
      if (response && response.ok && response.type === 'basic') {
        void cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }

  const response = await refresh;
  return (
    response ||
    new Response('', { status: 504, statusText: 'Offline and not cached' })
  );
}

// ── Explicit invalidation ─────────────────────────────────────────────────────
// Lets the page drop the shell (e.g. after a forced sign-out) without needing
// a full SW lifecycle cycle.

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (type === 'CLEAR_CACHES') {
    event.waitUntil(caches.keys().then((names) =>
      Promise.all(names.filter((n) => n.startsWith('docuvault-')).map((n) => caches.delete(n)))
    ));
  }
});
