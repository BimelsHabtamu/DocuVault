/**
 * ConnectionBanner — sticky top-of-page notification for offline / server-down states.
 *
 * Renders nothing when the connection is fine AND justRestored is false.
 * Shows a slim amber/red banner for 'offline', 'server-down', and 'reconnecting'.
 * Briefly shows a green "Connection restored" confirmation on reconnection.
 * Also registers the api.js bridge on first mount so that network errors
 * triggered by fetch() calls immediately update the global status.
 */

import { useEffect } from 'react';
import { useNetwork } from '../../hooks/useNetwork';
import { registerMarkServerDown } from '../../services/api';

const BANNER_CONFIG = {
  offline: {
    icon: '📡',
    message: 'You are offline. Please check your internet connection.',
    cls: 'conn-banner conn-banner--offline',
  },
  'server-down': {
    icon: '⚠️',
    message: 'Server connection unavailable. Please try again later.',
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

export default function ConnectionBanner() {
  const { status, markServerDown, justRestored } = useNetwork();

  // Bridge: tell api.js how to signal the context when a fetch() fails
  useEffect(() => {
    registerMarkServerDown(markServerDown);
  }, [markServerDown]);

  // Show "restored" banner briefly after coming back online
  if (justRestored && status === 'online') {
    const cfg = BANNER_CONFIG.restored;
    return (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cfg.cls}
        id="connection-banner"
      >
        <span className="conn-banner__icon" aria-hidden="true">{cfg.icon}</span>
        <span className="conn-banner__msg">{cfg.message}</span>
      </div>
    );
  }

  const cfg = BANNER_CONFIG[status];
  if (!cfg) return null; // 'online' — nothing to show

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cfg.cls}
      id="connection-banner"
    >
      <span className="conn-banner__icon" aria-hidden="true">{cfg.icon}</span>
      <span className="conn-banner__msg">{cfg.message}</span>
    </div>
  );
}
