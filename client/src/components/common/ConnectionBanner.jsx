/**
 * ConnectionBanner — sticky top-of-page notification for offline / server-down states.
 *
 * Renders nothing when the connection is fine AND justRestored is false.
 * Shows a slim amber/red banner for 'offline', 'server-down', and 'reconnecting'.
 * Briefly shows a green "Connection restored" confirmation on reconnection.
 * Also registers the api.js bridge on first mount so that network errors
 * triggered by fetch() calls immediately update the global status.
 *
 * While offline the app is NOT dead — GET requests fall back to the IndexedDB
 * cache (see services/offlineCache.js), so the banner says so and stamps the
 * data with the time it was saved instead of implying the screen is empty.
 */

import { useEffect } from 'react';
import { useNetwork } from '../../hooks/useNetwork';
import { useCacheHit } from '../../hooks/useOfflineCache';
import { registerMarkServerDown } from '../../services/api';

const BANNER_CONFIG = {
  offline: {
    icon: '📡',
    message: 'You are offline. Showing your saved data — changes need a connection.',
    cls: 'conn-banner conn-banner--offline',
  },
  'server-down': {
    icon: '⚠️',
    message: 'Server connection unavailable. Showing your saved data.',
    cls: 'conn-banner conn-banner--server-down',
  },
  reconnecting: {
    icon: '🔄',
    message: 'Reconnecting…',
    cls: 'conn-banner conn-banner--reconnecting',
  },
  restored: {
    icon: '✅',
    message: 'Connection restored. All features are available again.',
    cls: 'conn-banner conn-banner--restored',
  },
};

/** "3 minutes ago" style label for the saved-data chip. */
function savedAgoLabel(storedAt) {
  if (!storedAt) return 'saved earlier';
  const seconds = Math.max(0, Math.round((Date.now() - storedAt) / 1000));
  if (seconds < 60) return 'saved just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `saved ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `saved ${hours}h ago`;
  return `saved ${Math.round(hours / 24)}d ago`;
}

export default function ConnectionBanner() {
  const { status, markServerDown, justRestored, retryNow } = useNetwork();
  const lastCacheHit = useCacheHit();

  // Bridge: tell api.js how to signal the context when a fetch() fails
  useEffect(() => {
    registerMarkServerDown(markServerDown);
  }, [markServerDown]);

  const cfg = BANNER_CONFIG[justRestored && status === 'online' ? 'restored' : status];
  if (!cfg) return null; // 'online' with nothing to restore — stay quiet

  const canRetry = status === 'offline' || status === 'server-down';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cfg.cls}
      id="connection-banner"
    >
      <span className="conn-banner__icon" aria-hidden="true">{cfg.icon}</span>
      <span className="conn-banner__msg">
        {cfg.message}
        {lastCacheHit && (
          <span className="conn-banner__cached">{savedAgoLabel(lastCacheHit.storedAt)}</span>
        )}
      </span>
      {canRetry && (
        <button type="button" className="conn-banner__retry" onClick={retryNow}>
          Retry now
        </button>
      )}
    </div>
  );
}
