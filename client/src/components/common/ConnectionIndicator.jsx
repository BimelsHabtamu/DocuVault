/**
 * ConnectionIndicator — small status pill shown in the Navbar.
 *
 * 🟢 Online        (hidden when fully online to reduce noise — optional, change below)
 * 🔴 Offline
 * 🟡 Reconnecting
 * ⚠️  Server down
 *
 * While offline the app still renders saved data from IndexedDB, so the label
 * says "saved" rather than implying the session is broken.
 */

import { useNetwork } from '../../hooks/useNetwork';
import { useCacheHit } from '../../hooks/useOfflineCache';

const INDICATOR_CONFIG = {
  online: {
    dot: 'conn-dot conn-dot--online',
    label: 'Online',
    show: false, // hide when healthy to avoid cluttering the navbar
  },
  offline: {
    dot: 'conn-dot conn-dot--offline',
    label: 'Offline',
    cachedLabel: 'Offline · saved data',
    show: true,
  },
  'server-down': {
    dot: 'conn-dot conn-dot--server-down',
    label: 'Server Down',
    cachedLabel: 'Server down · saved data',
    show: true,
  },
  reconnecting: {
    dot: 'conn-dot conn-dot--reconnecting',
    label: 'Reconnecting',
    show: true,
  },
};

export default function ConnectionIndicator() {
  const { status } = useNetwork();
  const lastCacheHit = useCacheHit();
  const cfg = INDICATOR_CONFIG[status] ?? INDICATOR_CONFIG.online;

  if (!cfg.show) return null;

  const label = lastCacheHit && cfg.cachedLabel ? cfg.cachedLabel : cfg.label;

  return (
    <span
      className="conn-indicator"
      title={label}
      aria-label={`Connection status: ${label}`}
      role="status"
    >
      <span className={cfg.dot} aria-hidden="true" />
      <span className="conn-indicator__label">{label}</span>
    </span>
  );
}
