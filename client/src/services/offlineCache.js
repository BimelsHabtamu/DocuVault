/**
 * offlineCache.js — IndexedDB-backed store for API responses.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The app is a document-automation workspace; users expect to be able to open
 * it on a laptop with no connectivity and still see their templates, document
 * list and dashboard numbers. Previously every GET died on the floor the moment
 * `navigator.onLine` went false, so the whole UI went blank behind an
 * "you are offline" banner.
 *
 * This module is the persistence half of the fix. `api.js` reads through it
 * (network-first, cache as fallback) and this file owns everything that makes
 * that safe:
 *
 *   • Namespacing — entries are stored under the signed-in user's id, so two
 *     people sharing a machine never see each other's cached documents.
 *   • TTL         — a cached read is only served while offline if it is younger
 *     than DEFAULT_TTL_MS; older entries are treated as a miss and evicted.
 *   • Invalidation — any successful mutation calls `clearNamespaceCache()` so a
 *     stale list can never be shown after the user changed something.
 *   • Quota handling — on QuotaExceededError the oldest entries are evicted and
 *     the write is retried once, rather than throwing into the request path.
 *
 * EVERY public function is failure-tolerant: private-browsing modes, disabled
 * IndexedDB, corrupted databases and quota errors all degrade to "no cache"
 * rather than breaking the app. Offline support is an enhancement here, never a
 * hard dependency.
 */

const DB_NAME = 'docuvault-offline';
const DB_VERSION = 1;
const RESP_STORE = 'responses';
const META_STORE = 'meta';

const NAMESPACE_KEY = 'activeNamespace';
const LAST_SYNC_KEY = 'lastSyncAt';

/** Cached reads older than this are refused while offline (7 days). */
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** How many oldest entries to drop when the browser reports a full quota. */
const QUOTA_EVICTION_BATCH = 25;

let dbPromise = null;
let namespace = null;
let namespaceReady = null;

// ── Activity pub/sub ──────────────────────────────────────────────────────────
// api.js fires these; hooks/components subscribe to show "showing saved data".

const listeners = new Set();

/** The last read that was served off the local cache. */
let lastCacheHit = null;

/**
 * Subscribe to cache activity (a read was served from cache, a sync happened).
 * @param {(event: {type: string, path?: string, storedAt?: number, at: number}) => void} fn
 * @returns {() => void} unsubscribe
 */
export function subscribeCacheActivity(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Subscribe and immediately receive the most recent cache hit, if any. */
export function subscribeCacheHits(fn) {
  const unsubscribe = subscribeCacheActivity(fn);
  if (typeof fn === 'function' && lastCacheHit) fn(lastCacheHit);
  return unsubscribe;
}

/** Most recent cache hit without subscribing: `{ path, storedAt, at } | null`. */
export function getLastCacheHit() {
  return lastCacheHit;
}

function emit(event) {
  listeners.forEach((fn) => {
    try {
      fn(event);
    } catch {
      /* a broken subscriber must never break a request */
    }
  });
}

/** Called by api.js when a live read had to be answered from the cache. */
export function noteCacheServed({ path, storedAt }) {
  lastCacheHit = { type: 'cache-hit', path, storedAt, at: Date.now() };
  emit(lastCacheHit);
}

/** True when this browser can actually use the cache (used to skip work). */
export function isOfflineCacheAvailable() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

// ── IndexedDB plumbing ────────────────────────────────────────────────────────

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!isOfflineCacheAvailable()) {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }

    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(err);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RESP_STORE)) {
        const store = db.createObjectStore(RESP_STORE, { keyPath: 'key' });
        store.createIndex('by_namespace', 'namespace', { unique: false });
        store.createIndex('by_storedAt', 'storedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // Another tab upgraded the schema — close so it is not blocked forever.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => reject(request.error || new Error('IndexedDB open failed.'));
    request.onblocked = () => reject(new Error('IndexedDB open blocked by another tab.'));
  });

  // Allow a later call to retry after a failure, without leaking the rejection.
  dbPromise.catch(() => {
    dbPromise = null;
  });

  return dbPromise;
}

/**
 * Runs `fn(store)` inside a transaction and resolves once it commits.
 * `fn` may return an IDBRequest, whose `.result` becomes the resolved value.
 */
function runStore(storeName, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        let transaction;
        try {
          transaction = db.transaction(storeName, mode);
        } catch (err) {
          reject(err);
          return;
        }

        let request;
        try {
          request = fn(transaction.objectStore(storeName));
        } catch (err) {
          try {
            transaction.abort();
          } catch {
            /* already finished */
          }
          reject(err);
          return;
        }

        let value;
        if (request && typeof request === 'object' && 'result' in request) {
          request.onsuccess = () => {
            value = request.result;
          };
        }

        transaction.oncomplete = () => resolve(value);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () =>
          reject(transaction.error || new Error('IndexedDB transaction aborted.'));
      })
  );
}

// ── Namespace (per-user isolation) ────────────────────────────────────────────

async function getNamespace() {
  if (namespace) return namespace;
  if (!namespaceReady) {
    namespaceReady = runStore(META_STORE, 'readonly', (store) => store.get(NAMESPACE_KEY))
      .then((value) => (typeof value === 'string' && value ? value : 'anon'))
      .catch(() => 'anon');
  }
  namespace = await namespaceReady;
  return namespace;
}

/**
 * Point the cache at a different user (or 'anon' when signed out).
 * Switching users wipes the previous user's entries so their documents cannot
 * be read by whoever signs in next on the same machine.
 */
export async function setCacheNamespace(next) {
  const target = String(next ?? 'anon');
  const current = await getNamespace();
  if (current === target) return;

  await clearNamespaceCache(current);

  namespace = target;
  namespaceReady = Promise.resolve(target);
  try {
    await runStore(META_STORE, 'readwrite', (store) => store.put(target, NAMESPACE_KEY));
  } catch {
    /* non-fatal: the in-memory namespace still applies for this tab */
  }
}

function entryKeyFor(ns, path) {
  return `${ns}::${path}`;
}

// ── Public read/write API ─────────────────────────────────────────────────────

/**
 * Read a previously cached response.
 * @param {string} path  the API path used as the cache key (e.g. '/templates')
 * @param {object} [opts]
 * @param {number} [opts.maxAge]  override DEFAULT_TTL_MS
 * @returns {Promise<{payload: any, storedAt: number, path: string}|null>}
 */
export async function readCachedResponse(path, { maxAge = DEFAULT_TTL_MS } = {}) {
  try {
    const ns = await getNamespace();
    const entry = await runStore(RESP_STORE, 'readonly', (store) =>
      store.get(entryKeyFor(ns, path))
    );

    if (!entry || typeof entry.storedAt !== 'number') return null;

    if (Date.now() - entry.storedAt > maxAge) {
      evictPath(path);
      return null;
    }

    return { payload: entry.payload, storedAt: entry.storedAt, path };
  } catch {
    return null;
  }
}

/**
 * Store a response. Never throws, never blocks the caller's request — the
 * write is awaited only so a quota failure can trigger eviction, and callers
 * are expected to fire it without awaiting.
 *
 * Identical payloads are skipped. Several screens poll (notifications every
 * 15 s, bulk-job status), and rewriting byte-identical entries would burn quota
 * and — worse — keep `storedAt` artificially fresh, so the "saved 2 minutes ago"
 * label would keep resetting without the data actually changing.
 */
export async function writeCachedResponse(path, payload) {
  let ns;
  try {
    ns = await getNamespace();
    const key = entryKeyFor(ns, path);
    const storedAt = Date.now();

    const previous = await runStore(RESP_STORE, 'readonly', (store) => store.get(key));
    if (previous && samePayload(previous.payload, payload)) return;

    try {
      await runStore(RESP_STORE, 'readwrite', (store) =>
        store.put({ key, path, namespace: ns, storedAt, payload })
      );
    } catch (err) {
      if (!isQuotaError(err)) return;
      // Storage is full — make room by dropping the oldest entries, then retry once.
      await evictOldest(ns, QUOTA_EVICTION_BATCH);
      try {
        await runStore(RESP_STORE, 'readwrite', (store) =>
          store.put({ key, path, namespace: ns, storedAt, payload })
        );
      } catch {
        /* still no room — skip caching this response */
      }
    }
  } catch {
    /* cache is best-effort */
  }
}

/** Cheap structural equality; falls back to "not equal" on anything odd. */
function samePayload(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function isQuotaError(err) {
  if (!err) return false;
  const name = err.name || '';
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
}

/** Delete a single entry (used when a TTL-expired read is discovered). */
export async function evictPath(path) {
  try {
    const ns = await getNamespace();
    await runStore(RESP_STORE, 'readwrite', (store) => store.delete(entryKeyFor(ns, path)));
  } catch {
    /* best-effort */
  }
}

/**
 * Delete every entry for a namespace (defaults to the active user).
 * Called after any successful mutation so a stale list is never shown offline.
 */
export async function clearNamespaceCache(ns) {
  const target = ns ?? namespace;
  if (!target) return 0;

  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      let removed = 0;
      let transaction;
      try {
        transaction = db.transaction(RESP_STORE, 'readwrite');
      } catch {
        resolve(0);
        return;
      }

      const index = transaction.objectStore(RESP_STORE).index('by_namespace');
      const request = index.openCursor(IDBKeyRange.only(target));

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        cursor.delete();
        removed += 1;
        cursor.continue();
      };

      transaction.oncomplete = () => resolve(removed);
      transaction.onerror = () => resolve(removed);
      transaction.onabort = () => resolve(removed);
    });
  } catch {
    return 0;
  }
}

/** Wipe everything — used on explicit sign-out. */
export async function clearAllCaches() {
  try {
    await runStore(RESP_STORE, 'readwrite', (store) => store.clear());
    await runStore(META_STORE, 'readwrite', (store) => store.clear());
  } catch {
    /* best-effort */
  }
  namespace = null;
  namespaceReady = null;
}

async function evictOldest(ns, count) {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      let seen = 0;
      let transaction;
      try {
        transaction = db.transaction(RESP_STORE, 'readwrite');
      } catch {
        resolve();
        return;
      }

      const index = transaction.objectStore(RESP_STORE).index('by_storedAt');
      const request = index.openCursor();

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || seen >= count) return;
        if (cursor.value.namespace === ns) {
          cursor.delete();
          seen += 1;
        }
        cursor.continue();
      };

      transaction.oncomplete = resolve;
      transaction.onerror = resolve;
      transaction.onabort = resolve;
    });
  } catch {
    /* best-effort */
  }
}

// ── Sync bookkeeping + stats (surfaced in the UI) ─────────────────────────────

/** Record that we just pulled fresh data from the server. */
export async function noteSync() {
  const at = Date.now();
  try {
    await runStore(META_STORE, 'readwrite', (store) => store.put(at, LAST_SYNC_KEY));
  } catch {
    /* best-effort */
  }
  // Live data has landed — the "showing saved data" notice is no longer true.
  lastCacheHit = null;
  emit({ type: 'sync', at });
}

/** Timestamp of the last successful server read, or null if never. */
export async function getLastSyncAt() {
  try {
    const value = await runStore(META_STORE, 'readonly', (store) => store.get(LAST_SYNC_KEY));
    return typeof value === 'number' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Entry count / rough byte size / last sync for the active user — used by the
 * "offline storage" panel so users can see and clear what is being kept.
 */
export async function getCacheStats() {
  const empty = { entries: 0, bytes: 0, lastSyncAt: null };
  try {
    const ns = await getNamespace();
    const db = await openDb();

    const tally = await new Promise((resolve) => {
      let entries = 0;
      let bytes = 0;
      let transaction;
      try {
        transaction = db.transaction(RESP_STORE, 'readonly');
      } catch {
        resolve(empty);
        return;
      }

      const index = transaction.objectStore(RESP_STORE).index('by_namespace');
      const request = index.openCursor(IDBKeyRange.only(ns));

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        entries += 1;
        try {
          // Cheap proxy for stored size; good enough for a "cached N MB" label.
          bytes += JSON.stringify(cursor.value.payload ?? null).length * 2;
        } catch {
          bytes += 0;
        }
        cursor.continue();
      };

      transaction.oncomplete = () => resolve({ entries, bytes });
      transaction.onerror = () => resolve({ entries, bytes });
      transaction.onabort = () => resolve({ entries, bytes });
    });

    return { ...tally, lastSyncAt: await getLastSyncAt() };
  } catch {
    return empty;
  }
}
