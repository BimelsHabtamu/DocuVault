/**
 * useOfflineCache — read/write access to the local IndexedDB cache.
 *
 * Two independent concerns, deliberately kept as separate hooks:
 *
 *   useCacheHit()      — "is the screen in front of me live or saved data?"
 *                         Returns the most recent cache hit so the connection
 *                         banner can say "showing data saved <when>".
 *
 *   useOfflineCache()  — size/stats + an explicit clear, for an "offline
 *                         storage" panel so users can see and reclaim what is
 *                         stored on their device.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  clearNamespaceCache,
  getCacheStats,
  isOfflineCacheAvailable,
  subscribeCacheHits,
} from '../services/offlineCache';

/**
 * Tracks the most recent read that was answered from the local cache instead of
 * the server. `null` means everything on screen came from the live API.
 *
 * @returns {{path: string, storedAt: number, at: number}|null}
 */
export function useCacheHit() {
  const [lastCacheHit, setLastCacheHit] = useState(null);

  useEffect(
    () =>
      subscribeCacheHits((event) => {
        if (event?.type === 'cache-hit') setLastCacheHit(event);
        else setLastCacheHit(null);
      }),
    []
  );

  return lastCacheHit;
}

/**
 * Cache size for the signed-in user, plus a manual clear.
 *
 * @returns {{
 *   available: boolean,
 *   stats: {entries: number, bytes: number, lastSyncAt: number|null}|null,
 *   isClearing: boolean,
 *   refresh: () => Promise<void>,
 *   clear: () => Promise<void>,
 * }}
 */
export function useOfflineCache() {
  const [stats, setStats] = useState(null);
  const [isClearing, setIsClearing] = useState(false);
  const available = isOfflineCacheAvailable();

  const refresh = useCallback(async () => {
    if (!available) {
      setStats({ entries: 0, bytes: 0, lastSyncAt: null });
      return;
    }
    setStats(await getCacheStats());
  }, [available]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const clear = useCallback(async () => {
    setIsClearing(true);
    try {
      await clearNamespaceCache();
    } finally {
      setIsClearing(false);
      await refresh();
    }
  }, [refresh]);

  return { available, stats, isClearing, refresh, clear };
}

/** Format a byte count for display, e.g. 1536 → "1.5 KB". */
export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
