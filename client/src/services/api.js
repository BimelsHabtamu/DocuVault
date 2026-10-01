import {
  readCachedResponse,
  writeCachedResponse,
  clearNamespaceCache,
  evictPath,
  noteSync,
  noteCacheServed,
  subscribeCacheActivity,
  subscribeCacheHits,
  getLastCacheHit,
} from './offlineCache';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';


const CACHE_FALLBACK_STATUSES = new Set([502, 503, 504]);

let inMemoryToken = null;

export function setAuthToken(token) {
  inMemoryToken = token;
}

export function getAuthToken() {
  return inMemoryToken;
}

let _markServerDown = null;


export function registerMarkServerDown(fn) {
  _markServerDown = fn;
}

// Re-exported so UI can tell "served from cache" apart from "live" responses.
export { subscribeCacheActivity, subscribeCacheHits, getLastCacheHit };

// ── Network pre-check error ───────────────────────────────────────────────────
export class OfflineError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OfflineError';
    this.isOfflineError = true;
  }
}

export class OfflineCacheMissError extends OfflineError {
  constructor(path) {
    super(
      'You are offline and this screen has not been saved on this device yet. Reconnect once to make it available offline.'
    );
    this.name = 'OfflineCacheMissError';
    this.isOfflineCacheMiss = true;
    this.path = path;
  }
}

// ── Outage short-circuit ──────────────────────────────────────────────────────

const SUSPECT_WINDOW_MS = 10_000;
let suspectDownUntil = 0;

// ── Read-through cache helpers ────────────────────────────────────────────────

function markFromCache(payload, storedAt) {
  if (payload && typeof payload === 'object') {
    payload.fromCache = true;
    payload.cachedAt = storedAt;
  }
  return payload;
}

async function serveFromCache(path) {
  const hit = await readCachedResponse(path);
  if (!hit) return null;

  markFromCache(hit.payload, hit.storedAt);
  noteCacheServed({ path, storedAt: hit.storedAt });
  return hit.payload;
}

/**
 * Returns an array of cached GET paths to evict after a mutation at `mutationPath`.
 * Returns null to signal "full namespace clear" (unknown / uncategorised mutation).
 *
 * @param {string} mutationPath  e.g. '/templates/7'
 * @returns {string[] | null}
 */
function getInvalidationTargets(mutationPath) {
  const p = mutationPath.split('?')[0]; // strip query string

  // Templates
  if (p === '/templates' || p.startsWith('/templates/')) {
    return ['/templates'];
  }

  // Documents (generate, bulk, status patches, revoke, resubmit)
  if (
    p === '/documents/generate' ||
    p === '/documents/generate/bulk' ||
    p === '/documents/validate-bulk' ||
    p.startsWith('/documents/') && (
      p.endsWith('/revoke') ||
      p.endsWith('/hand-delivered') ||
      p.endsWith('/secure-delivery') ||
      p.endsWith('/resubmit-delivery')
    )
  ) {
    return ['/documents/search', '/signatures/pending'];
  }

  // Signatures / approvals
  if (p === '/signatures' || p.startsWith('/signatures/')) {
    return ['/signatures/pending', '/documents/search'];
  }

  // Users
  if (p === '/users' || p.startsWith('/users/')) {
    return ['/users', '/users/approvers', '/users/recipients'];
  }

  // Notifications
  if (p === '/notifications' || p.startsWith('/notifications/')) {
    return ['/notifications'];
  }

  // Auth (profile updates)
  if (p === '/users/me' || p.startsWith('/users/me/')) {
    return []; // nothing list-level changes; profile is loaded fresh from /auth/me
  }

  // Settings
  if (p === '/settings' || p.startsWith('/settings/')) {
    return ['/settings', '/settings/database'];
  }

  // External DB connections
  if (p === '/external-db' || p.startsWith('/external-db/')) {
    return ['/external-db'];
  }

  // Archive
  if (p === '/archive/run') {
    return ['/archive/overview'];
  }

  // Anything not recognised → full clear (safe fallback)
  return null;
}

async function invalidateAfterMutation(mutationPath) {
  const targets = getInvalidationTargets(mutationPath);

  if (targets === null) {
    // Unknown mutation — fall back to clearing everything (original behaviour)
    await clearNamespaceCache();
    return;
  }

  // Evict each stale path in parallel
  if (targets.length > 0) {
    await Promise.allSettled(targets.map((p) => evictPath(p)));
  }
  // targets.length === 0 means "nothing to evict" (e.g. own-profile update)
}

// ── Core request function ─────────────────────────────────────────────────────

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const isRead = method === 'GET' || method === 'HEAD';

  const url = `${BASE_URL}${path}`;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(inMemoryToken ? { Authorization: `Bearer ${inMemoryToken}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    // fetch() itself rejected — backend unreachable, DNS failure, etc.
    if (import.meta.env.DEV) {
      console.error('[api] Network error calling', url, networkErr);
    }
    // Notify the NetworkContext so the banner appears immediately
    if (_markServerDown) _markServerDown();
    suspectDownUntil = Date.now() + SUSPECT_WINDOW_MS;

    if (isRead) {
      const cached = await serveFromCache(path);
      if (cached) return cached;
      throw new OfflineCacheMissError(path);
    }

    throw new OfflineError(
      'Unable to connect to the server. Please check your connection and try again.'
    );
  }

  let payload;
  try {
    payload = await res.json();
  } catch {
    throw new Error(`Unexpected response from server (status ${res.status}).`);
  }

  if (!res.ok) {
    // A gateway hiccup is transient — better to show saved data than an error.
    if (isRead && CACHE_FALLBACK_STATUSES.has(res.status)) {
      const cached = await serveFromCache(path);
      if (cached) return cached;
    }

    const error = new Error(payload.message || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.payload = payload;
    throw error;
  }

  // ── Fresh data in hand ───────────────────────────────────────────────────
  suspectDownUntil = 0;
  if (isRead) {
    if (payload && typeof payload === 'object') {
      payload.fromCache = false;
      payload.cachedAt = null;
    }
    // Fire-and-forget: caching must never add latency to the response.
    void writeCachedResponse(path, payload);
    void noteSync();
  } else {
    void invalidateAfterMutation(path);
  }

  return payload; // { success, message, data }
}

export const api = {
  get:    (path)        => request(path),
  post:   (path, body)  => request(path, { method: 'POST',  body }),
  put:    (path, body)  => request(path, { method: 'PUT',   body }),
  patch:  (path, body)  => request(path, { method: 'PATCH', body }),
  delete: (path)        => request(path, { method: 'DELETE' }),
};